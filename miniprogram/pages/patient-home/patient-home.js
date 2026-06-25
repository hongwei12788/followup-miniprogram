const api = require("../../utils/api");

const SUBSCRIBE_PROMPT_INTERVAL_MS = 12 * 60 * 60 * 1000;

Page({
  data: {
    patient: null,
    tasks: [],
    reminders: [],
    subscribeTemplates: [],
    subscribeEnabled: false,
    subscribeLoading: false,
    subscribeStatus: buildSubscribeViewModel(),
    showPatientHint: false,
    patientHintText: "",
    loading: false,
  },

  async onShow() {
    this.load();
  },

  async load() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const me = await api.getMe();
      if (me.user.role !== "patient") {
        wx.redirectTo({ url: "/pages/staff-workbench/staff-workbench" });
        return;
      }
      const patient = (me.user.patients || [])[0] || null;

      const [tasks, reminders, subscribeStatusRes] = await Promise.all([
        api.getMyTasks(),
        api.getMyReminders(),
        this.loadSubscribeStatusCompat(),
      ]);
      const reminderItems = formatReminders(reminders.list);
      const subscribeStatus = buildSubscribeViewModel(subscribeStatusRes);

      this.setData({
        patient,
        tasks: formatTasks(tasks.list),
        reminders: reminderItems,
        subscribeTemplates: subscribeStatus.templates,
        subscribeEnabled: subscribeStatus.enabled,
        subscribeStatus,
        showPatientHint: !patient && /^1\d{10}$/.test(String(me.user.phone || "").replace(/\s+/g, "")),
        patientHintText: patient
          ? ""
          : "系统会按当前注册手机号自动匹配患者资料。如暂未显示，可点下方按钮重新匹配。",
      });

      const reminderModalDelay = this.notifyUnreadReminders(me.user.id, reminderItems) ? 900 : 300;
      this.maybePromptSubscribe(me.user.id, subscribeStatus, reminderModalDelay);
    } catch (e) {
      wx.showToast({ title: e?.error || "加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  async refreshSubscribeStatus() {
    try {
      const res = await this.loadSubscribeStatusCompat();
      const subscribeStatus = buildSubscribeViewModel(res);
      this.setData({
        subscribeTemplates: subscribeStatus.templates,
        subscribeEnabled: subscribeStatus.enabled,
        subscribeStatus,
      });
      return subscribeStatus;
    } catch (err) {
      const subscribeStatus = buildSubscribeViewModel();
      this.setData({
        subscribeTemplates: [],
        subscribeEnabled: false,
        subscribeStatus,
      });
      return subscribeStatus;
    }
  },

  async loadSubscribeStatusCompat() {
    try {
      return await api.getWechatSubscribeStatus();
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
      const fallback = await api.getWechatSubscribeTemplates().catch(() => ({ templates: [] }));
      return {
        configured: (fallback.templates || []).length > 0,
        templates: (fallback.templates || []).map((item) => ({
          ...item,
          availableCount: 0,
          status: "missing",
          accepted: false,
          needsRefresh: true,
        })),
        summary: {
          needSubscribe: (fallback.templates || []).length > 0,
          totalAvailableCount: 0,
          acceptedCount: 0,
          missingTitles: (fallback.templates || []).map((item) => item.title).filter(Boolean),
          exhaustedTitles: [],
          rejectedTitles: [],
        },
      };
    }
  },

  maybePromptSubscribe(userId, subscribeStatus, delay = 300) {
    if (!userId || !subscribeStatus?.enabled || !subscribeStatus.needSubscribe) return;
    const promptKey = getSubscribePromptKey(userId);
    const now = Date.now();
    const promptState = wx.getStorageSync(promptKey) || {};
    const sameReason = promptState.reasonKey === subscribeStatus.reasonKey;
    if (sameReason && promptState.at && now - promptState.at < SUBSCRIBE_PROMPT_INTERVAL_MS) {
      return;
    }

    wx.setStorageSync(promptKey, { at: now, reasonKey: subscribeStatus.reasonKey });
    setTimeout(() => {
      wx.showModal({
        title: "接收微信提醒",
        content: subscribeStatus.promptText,
        confirmText: "开启提醒",
        cancelText: "稍后",
        success: async (res) => {
          if (!res.confirm) return;
          await this.requestWechatSubscribe();
        },
      });
    }, delay);
  },

  async requestWechatSubscribe() {
    if (this.data.subscribeLoading) return;
    const tmplIds = [...new Set(
      this.data.subscribeTemplates
        .map((item) => String(item.templateId || "").trim())
        .filter(Boolean)
    )];
    if (!tmplIds.length) {
      wx.showToast({ title: "微信提醒暂未配置", icon: "none" });
      return;
    }

    this.setData({ subscribeLoading: true });
    try {
      const result = await wx.requestSubscribeMessage({ tmplIds });
      await api.saveWechatSubscribeResults({ results: result });
      const subscribeStatus = await this.refreshSubscribeStatus();
      const accepted = Object.values(result).filter((value) => value === "accept").length;
      wx.showToast({
        title: accepted ? subscribeStatus.successText : "本次未开启微信提醒",
        icon: "none",
      });
    } catch (err) {
      wx.showToast({ title: formatSubscribeError(err), icon: "none" });
    } finally {
      this.setData({ subscribeLoading: false });
    }
  },

  async rebindCurrentPhone() {
    const phone = String(this.data.accountDebug?.phone || "").replace(/\s+/g, "");
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: "当前账号手机号不可用", icon: "none" });
      return;
    }
    try {
      const res = await api.bindPhone({ phone });
      wx.showToast({
        title: res?.matched ? "已重新绑定患者资料" : "手机号已保存，请稍后重试",
        icon: "none",
      });
      await this.load();
    } catch (err) {
      wx.showToast({ title: err?.error || "重新绑定失败", icon: "none" });
    }
  },

  goSurgery() {
    wx.navigateTo({ url: "/pages/patient-surgery/patient-surgery" });
  },

  goFollowup() {
    wx.navigateTo({ url: "/pages/patient-followup/patient-followup" });
  },

  notifyUnreadReminders(userId, reminders) {
    if (!userId || !Array.isArray(reminders) || !reminders.length) {
      this.updateReminderBadge(0);
      return false;
    }

    const storageKey = `seenReminderIds:${userId}`;
    const seenIds = wx.getStorageSync(storageKey) || [];
    const seenSet = new Set((Array.isArray(seenIds) ? seenIds : []).map(String));
    const unread = reminders.filter((item) => !seenSet.has(String(item.id)));
    this.updateReminderBadge(unread.length);
    if (!unread.length) return false;

    const latest = unread[0];
    const content = unread.length > 1
      ? `${latest.message}\n还有 ${unread.length - 1} 条新提醒，请在首页查看。`
      : latest.message;

    wx.showModal({
      title: "新的医护提醒",
      content: content || "你有新的医护提醒，请在首页查看。",
      showCancel: false,
      confirmText: "知道了",
      complete: () => {
        const nextIds = Array.from(new Set([
          ...seenSet,
          ...reminders.map((item) => String(item.id)),
        ])).slice(-200);
        wx.setStorageSync(storageKey, nextIds);
        this.updateReminderBadge(0);
      },
    });
    return true;
  },

  updateReminderBadge(count) {
    if (count > 0) {
      wx.setTabBarBadge({ index: 0, text: String(Math.min(count, 99)) });
      return;
    }
    wx.removeTabBarBadge({ index: 0 });
  },
});

function buildSubscribeViewModel(source = {}) {
  const templates = (source.templates || []).map((item) => ({
    ...item,
    templateId: String(item.templateId || "").trim(),
    availableCount: Number(item.availableCount || 0),
  })).filter((item) => item.templateId);
  const summary = source.summary || {};
  const enabled = !!source.configured && templates.length > 0;
  const totalAvailableCount = Number(summary.totalAvailableCount || 0);
  const missingTitles = ensureArray(summary.missingTitles);
  const exhaustedTitles = ensureArray(summary.exhaustedTitles);
  const rejectedTitles = ensureArray(summary.rejectedTitles);
  const needSubscribe = !!summary.needSubscribe;
  const active = enabled && !needSubscribe && totalAvailableCount > 0;

  let statusText = "微信提醒暂未配置";
  let detailText = "当前仍会保留小程序提醒和短信兜底。";
  let actionText = "开启微信提醒";
  let promptText = "开启后，可在微信服务通知中接收随访提醒和拔管提醒。";

  if (enabled && active) {
    statusText = `微信提醒已开启，当前剩余 ${totalAvailableCount} 次提醒机会`;
    detailText = "医生发送提醒时，会优先通过微信服务通知触达你。";
    actionText = "补充提醒次数";
    promptText = "为避免后续提醒次数用完，现在可以顺手补充一次微信提醒授权。";
  } else if (enabled) {
    const titles = [...missingTitles, ...exhaustedTitles, ...rejectedTitles];
    const titleText = titles.length ? `涉及：${titles.join("、")}` : "开启后，可在微信服务通知中接收随访提醒和拔管提醒。";
    statusText = totalAvailableCount > 0
      ? `部分微信提醒次数不足，当前剩余 ${totalAvailableCount} 次`
      : "微信提醒尚未完成授权";
    detailText = `${titleText} 当前仍会保留小程序提醒和短信兜底。`;
    actionText = totalAvailableCount > 0 ? "补充提醒次数" : "开启微信提醒";
    promptText = totalAvailableCount > 0
      ? `${titleText} 建议现在补充授权，避免后续漏掉提醒。`
      : `${titleText} 现在开启后，医生发送提醒时会优先走微信服务通知。`;
  }

  return {
    enabled,
    templates,
    totalAvailableCount,
    needSubscribe,
    active,
    statusText,
    detailText,
    actionText,
    promptText,
    successText: totalAvailableCount > 0 ? `已补充 ${totalAvailableCount} 次微信提醒机会` : "微信提醒已开启",
    reasonKey: JSON.stringify({
      missingTitles,
      exhaustedTitles,
      rejectedTitles,
      totalAvailableCount,
      needSubscribe,
    }),
    badgeText: active ? "已开启" : "待开启",
    badgeClass: active ? "subscribe-pill active" : "subscribe-pill warn",
  };
}

function ensureArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function getSubscribePromptKey(userId) {
  return `wechatSubscribePrompt:${userId}`;
}

function formatTasks(list) {
  return (list || []).map((item) => ({
    ...item,
    dueDateText: formatDate(item.dueDate),
    channelText: formatChannels(item.reminderChannels),
  }));
}

function formatReminders(list) {
  return (list || []).map((item) => ({
    ...item,
    createdAtText: formatDate(item.createdAt),
    channelText: channelLabel(item.channel),
  }));
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatChannels(value) {
  const labels = { in_app: "小程序", wechat: "微信提醒", sms: "短信" };
  return String(value || "in_app")
    .split(",")
    .map((item) => labels[item] || item)
    .join("、");
}

function channelLabel(value) {
  return { in_app: "小程序", wechat: "微信提醒", sms: "短信" }[value] || value || "小程序";
}

function formatSubscribeError(err) {
  const message = err?.errMsg || "";
  if (message.includes("No template data")) {
    return "订阅模板不可用，请检查模板 ID";
  }
  if (message.includes("cancel")) {
    return "已取消微信提醒授权";
  }
  return "订阅授权失败";
}

function isNotFoundError(err) {
  return err?.error === "Not Found" || err?.statusCode === 404 || err?.status === 404;
}
