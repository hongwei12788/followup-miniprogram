const api = require("../../utils/api");

Page({
  data: {
    patient: null,
    resultTitle: "",
    resultDescription: "",
    resultImages: [],
    reminderText: "",
    reminderChannel: "in_app",
    reminderChannelIndex: 0,
    reminderChannelOptions: [
      { label: "小程序提醒", value: "in_app" },
      { label: "短信提醒", value: "sms" },
    ],
    smsEnabled: false,
    wechatSubscribeEnabled: false,
    isAdmin: false,
  },

  async onLoad(options) {
    this.patientId = options.id;
    this.load();
  },

  async load() {
    try {
      const [patientRes, me] = await Promise.all([
        api.getPatient(this.patientId),
        api.getMe(),
      ]);
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
      const reminderChannelOptions = [];
      if (wechatSubscribeEnabled) {
        reminderChannelOptions.push({ label: "微信提醒", value: "wechat" });
      }
      reminderChannelOptions.push({ label: "小程序提醒", value: "in_app" });
      if (smsEnabled) {
        reminderChannelOptions.push({ label: "短信提醒", value: "sms" });
      }
      const defaultReminderChannel = wechatSubscribeEnabled ? "wechat" : "in_app";
      const defaultReminderChannelIndex = reminderChannelOptions.findIndex((item) => item.value === defaultReminderChannel);
      this.setData({
        patient: formatPatient(patientRes.patient),
        isAdmin: me.user.role === "admin",
        smsEnabled,
        wechatSubscribeEnabled,
        reminderChannelOptions,
        reminderChannelIndex: defaultReminderChannelIndex >= 0 ? defaultReminderChannelIndex : 0,
        reminderChannel: defaultReminderChannel,
      });
    } catch (e) {
      wx.showToast({ title: e?.error || "患者信息加载失败", icon: "none" });
    }
  },

  chooseResultImages() {
    wx.chooseMedia({
      count: 6,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const files = res.tempFiles.map((item) => item.tempFilePath);
        this.setData({ resultImages: this.data.resultImages.concat(files).slice(0, 6) });
      },
    });
  },

  removeResultImage(e) {
    const index = e.currentTarget.dataset.index;
    const resultImages = this.data.resultImages.filter((_, i) => i !== index);
    this.setData({ resultImages });
  },

  async submitResult() {
    if (!this.data.resultTitle) {
      wx.showToast({ title: "请填写检查名称", icon: "none" });
      return;
    }

    wx.showLoading({ title: "上传中" });
    try {
      const images = [];
      for (const path of this.data.resultImages) {
        const upload = await api.uploadCloudFile(path, "followup-results");
        images.push(upload.fileID);
      }

      const surgery = (this.data.patient.surgeries || [])[0];
      await api.createExaminationResult(this.patientId, {
        surgeryId: surgery ? surgery.id : null,
        title: this.data.resultTitle,
        description: this.data.resultDescription,
        images,
      });
      wx.hideLoading();
      wx.showToast({ title: "上传成功" });
      this.setData({ resultTitle: "", resultDescription: "", resultImages: [] });
      this.load();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e?.error || "上传失败", icon: "none" });
    }
  },

  previewResultImage(e) {
    const urls = e.currentTarget.dataset.urls || [];
    const current = e.currentTarget.dataset.current;
    wx.previewImage({ current, urls });
  },

  onReminderInput(e) {
    this.setData({ reminderText: e.detail.value });
  },

  onReminderChannelChange(e) {
    const index = Number(e.detail.value);
    const option = this.data.reminderChannelOptions[index];
    this.setData({
      reminderChannelIndex: index,
      reminderChannel: option.value,
    });
  },

  async sendReminder() {
    if (!this.data.reminderText) {
      wx.showToast({ title: "请输入提醒内容", icon: "none" });
      return;
    }
    if (this.data.reminderChannel === "sms" && !this.data.smsEnabled) {
      wx.showToast({ title: "短信提醒暂未开通", icon: "none" });
      return;
    }
    if (this.data.reminderChannel === "wechat" && !this.data.wechatSubscribeEnabled) {
      wx.showToast({ title: "微信提醒暂未配置", icon: "none" });
      return;
    }
    try {
      const res = await api.sendPatientReminder(this.patientId, {
        channel: this.data.reminderChannel,
        title: "随访提醒",
        message: this.data.reminderText,
      });
      const title = this.data.reminderChannel === "sms" ? "短信已发送" : "提醒已记录";
      wx.showToast({ title: res?.note || title, icon: "none" });
      this.setData({ reminderText: "" });
    } catch (e) {
      wx.showToast({ title: e?.error || "提醒失败", icon: "none" });
    }
  },

  deletePatient() {
    wx.showModal({
      title: "删除患者",
      content: "删除后将同步删除手术、随访任务和检查结果，确认继续吗？",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deletePatient(this.patientId);
          wx.showToast({ title: "已删除" });
          wx.navigateBack();
        } catch (e) {
          wx.showToast({ title: e?.error || "删除失败", icon: "none" });
        }
      },
    });
  },

  deleteResult(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "删除检查结果",
      content: "确认删除这条检查结果吗？",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteExaminationResult(this.patientId, id);
          wx.showToast({ title: "已删除" });
          this.load();
        } catch (err) {
          wx.showToast({ title: err?.error || "删除失败", icon: "none" });
        }
      },
    });
  },
});

function formatPatient(patient) {
  return {
    ...patient,
    surgeries: (patient.surgeries || []).map((item) => ({
      ...item,
      surgeryTimeText: formatDate(item.surgeryTime),
      catheterRemovalTimeText: formatDate(item.catheterRemovalTime),
    })),
    examinationResults: (patient.examinationResults || []).map((item) => ({
      ...item,
      createdAtText: formatDate(item.createdAt),
    })),
    followupTasks: (patient.followupTasks || []).map((item) => ({
      ...item,
      dueDateText: formatDate(item.dueDate),
    })),
  };
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
