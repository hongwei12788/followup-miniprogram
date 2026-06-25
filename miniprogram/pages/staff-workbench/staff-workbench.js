const api = require("../../utils/api");
Page({
  data: { stats: {} },
  async onShow() {
    try {
      const res = await api.getDashboard();
      this.setData({ stats: res });
    } catch(e) { console.error(e); }
  },
  goPatients() { wx.navigateTo({ url: "/pages/staff-patients/staff-patients" }); },
  goTasks() { wx.navigateTo({ url: "/pages/staff-followup-tasks/staff-followup-tasks" }); },
});