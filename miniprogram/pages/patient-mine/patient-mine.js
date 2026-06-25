const api = require("../../utils/api");

Page({
  data: {
    user: null,
    nickName: "",
    avatarUrl: "",
    roleText: "",
    bindingStatusText: "",
  },

  async onShow() {
    await this.loadUser();
  },

  async loadUser() {
    try {
      const res = await api.getMe();
      const user = res.user;
      this.setData({
        user,
        nickName: user.nickName || "",
        avatarUrl: user.avatarUrl || "",
        roleText: roleLabel(user.role),
        bindingStatusText: user.role === "patient"
          ? ((user.patients || []).length ? "已自动绑定患者资料" : "系统会按注册手机号自动匹配患者资料")
          : "",
      });
    } catch (e) {
      wx.showToast({ title: e?.error || "账号信息加载失败", icon: "none" });
    }
  },

  onChooseAvatar(e) {
    this.setData({ avatarUrl: e.detail.avatarUrl });
  },

  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  async saveProfile() {
    try {
      const res = await api.updateProfile({
        nickName: this.data.nickName,
        avatarUrl: this.data.avatarUrl,
      });
      this.setData({ user: res.user });
      getApp().globalData.userInfo = res.user;
      wx.showToast({ title: "资料已保存" });
    } catch (e) {
      wx.showToast({ title: e?.error || "保存失败", icon: "none" });
    }
  },

  logout() {
    wx.removeStorageSync("token");
    getApp().globalData.token = null;
    wx.redirectTo({ url: "/pages/login/login" });
  },
});

function roleLabel(role) {
  return {
    patient: "患者",
    doctor: "医生",
    nurse: "护士",
    admin: "管理员",
  }[role] || role || "未设置";
}
