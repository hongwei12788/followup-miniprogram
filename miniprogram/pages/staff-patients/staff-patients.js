const api = require("../../utils/api");
Page({
  data: { patients: [], q: "" },
  async onLoad() { this.load(); },
  async load() {
    try {
      const res = await api.getPatients({ q: this.data.q });
      this.setData({ patients: res.list });
    } catch(e) { console.error(e); }
  },
  onSearch(e) {
    this.setData({ q: e.detail.value });
    this.load();
  },
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: "/pages/staff-patient-detail/staff-patient-detail?id=" + id });
  },
  goAdd() {
    wx.navigateTo({ url: "/pages/staff-surgery-add/staff-surgery-add" });
  },
});