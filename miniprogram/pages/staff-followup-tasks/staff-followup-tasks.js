const api = require("../../utils/api");

Page({
  data: {
    tasks: [],
    status: "",
    isAdmin: false,
    smsEnabled: false,
    wechatSubscribeEnabled: false,
    loading: false,
  },

  async onLoad() {
    await this.loadMe();
    this.load();
  },

  async loadMe() {
    try {
      const me = await api.getMe();
      let smsEnabled = false;
      let wechatSubscribeEnabled = false;
      try {
        const featureRes = await api.getFeatureConfig();
        smsEnabled = !!featureRes.features?.sms;
      } catch (err) {
        smsEnabled = false;
      }
      try {
        const templatesRes = await api.getWechatSubscribeTemplates();
        wechatSubscribeEnabled = (templatesRes.templates || []).some((item) => item.scene === "followup" && item.templateId);
      } catch (err) {
        wechatSubscribeEnabled = false;
      }
      this.setData({
        isAdmin: me.user?.role === "admin",
        smsEnabled,
        wechatSubscribeEnabled,
      });
    } catch (e) {
      console.error(e);
    }
  },

  async load() {
    this.setData({ loading: true });
    try {
      const res = await api.getFollowupTasks({ status: this.data.status });
      this.setData({ tasks: formatTasks(res.list) });
    } catch (e) {
      wx.showToast({ title: e?.error || "任务加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  switchStatus(e) {
    this.setData({ status: e.currentTarget.dataset.status });
    this.load();
  },

  async markDone(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await api.updateTaskStatus(id, { status: "done" });
      wx.showToast({ title: "已标记完成" });
      this.load();
    } catch (err) {
      wx.showToast({ title: err?.error || "操作失败", icon: "none" });
    }
  },

  async remindPatient(e) {
    const id = e.currentTarget.dataset.id;
    const channel = e.currentTarget.dataset.channel || "in_app";
    if (channel === "sms" && !this.data.smsEnabled) {
      wx.showToast({ title: "短信提醒暂未开通", icon: "none" });
      return;
    }
    if (channel === "wechat" && !this.data.wechatSubscribeEnabled) {
      wx.showToast({ title: "微信提醒暂未配置", icon: "none" });
      return;
    }
    try {
      const res = await api.remindTask(id, { channel });
      const title = channel === "sms"
        ? "短信已发送"
        : (channel === "wechat" ? "已提醒患者" : "已记录提醒");
      wx.showToast({ title: res?.note || title, icon: "none" });
      this.load();
    } catch (err) {
      wx.showToast({ title: err?.error || "提醒失败", icon: "none" });
    }
  },

  deleteTask(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "删除随访任务",
      content: "确认删除这条随访任务和相关记录吗？",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteTask(id);
          wx.showToast({ title: "已删除" });
          this.load();
        } catch (err) {
          wx.showToast({ title: err?.error || "删除失败", icon: "none" });
        }
      },
    });
  },
});

function formatTasks(list) {
  return (list || []).map((item) => ({
    ...item,
    patientName: item.patient?.name || "未绑定患者",
    dueDateText: formatDate(item.dueDate),
    channelText: formatChannels(item.reminderChannels),
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
