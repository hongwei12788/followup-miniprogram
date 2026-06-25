const api = require("../../utils/api");

Page({
  data: {
    surgeries: [],
    results: [],
    loading: false,
  },

  async onLoad() {
    await this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const me = await api.getMe();
      const patient = me.user?.patients?.[0];
      if (!patient) {
        this.setData({ surgeries: [], results: [] });
        return;
      }

      const [surgeriesRes, resultsRes] = await Promise.all([
        api.getSurgeries(patient.id),
        api.getExaminationResults(patient.id),
      ]);
      this.setData({
        surgeries: formatSurgeries(surgeriesRes.list),
        results: formatResults(resultsRes.list),
      });
    } catch (e) {
      wx.showToast({ title: e?.error || "手术信息加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  previewResultImage(e) {
    const urls = e.currentTarget.dataset.urls || [];
    const current = e.currentTarget.dataset.current;
    wx.previewImage({ current, urls });
  },
});

function formatSurgeries(list) {
  return (list || []).map((item) => ({
    ...item,
    departmentName: item.department?.name || "未设置科室",
    surgeryTimeText: formatDate(item.surgeryTime),
    catheterRemovalTimeText: formatDate(item.catheterRemovalTime),
  }));
}

function formatResults(list) {
  return (list || []).map((item) => ({
    ...item,
    createdAtText: formatDate(item.createdAt),
  }));
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
