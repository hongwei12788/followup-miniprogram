const api = require("../../utils/api");

Page({
  data: {
    tasks: [],
    feedbackMap: {},
    loading: false,
  },

  async onLoad() {
    this.load();
  },

  async onShow() {
    this.load();
  },

  async load() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const tasksRes = await api.getMyTasks();
      this.setData({
        tasks: formatTasks(tasksRes.list),
      });
    } catch (e) {
      wx.showToast({ title: e?.error || "加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  updateFeedback(e) {
    const id = e.currentTarget.dataset.id;
    const feedbackMap = { ...this.data.feedbackMap, [id]: e.detail.value };
    this.setData({ feedbackMap });
  },

  async fillRecord(e) {
    const id = e.currentTarget.dataset.id;
    const content = this.data.feedbackMap[id] || "患者已确认提醒";
    try {
      await api.submitRecord(id, { content });
      wx.showToast({ title: "提交成功" });
      this.load();
    } catch (err) {
      wx.showToast({ title: err?.error || "提交失败", icon: "none" });
    }
  },
});

function formatTasks(list) {
  return (list || []).map((item) => ({
    ...item,
    surgeryName: item.surgery?.surgeryName || "未关联手术",
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
