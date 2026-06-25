const api = require("../../utils/api");

Page({
  data: {
    mode: "login",
    role: "patient",
    loading: false,
    phone: "",
    password: "",
    identityCode: "",
    agreedToTerms: false,
  },

  switchMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode, identityCode: "" });
  },

  onRoleChange(e) {
    this.setData({ role: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onIdentityCodeInput(e) {
    this.setData({ identityCode: e.detail.value });
  },

  onAgreementChange(e) {
    this.setData({ agreedToTerms: e.detail.value.includes("agree") });
  },

  openUserAgreement() {
    wx.navigateTo({ url: "/pages/user-agreement/user-agreement" });
  },

  openPrivacyPolicy() {
    wx.navigateTo({ url: "/pages/privacy-policy/privacy-policy" });
  },

  saveLogin(res) {
    wx.setStorageSync("token", res.token);
    getApp().globalData.token = res.token;
    getApp().globalData.userInfo = res.user;
  },

  goByRole(role) {
    if (role === "patient") {
      wx.switchTab({ url: "/pages/patient-home/patient-home" });
    } else {
      wx.redirectTo({ url: "/pages/staff-workbench/staff-workbench" });
    }
  },

  validateAccountForm() {
    const phone = this.data.phone.replace(/\s+/g, "");
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: "请输入正确的手机号", icon: "none" });
      return null;
    }
    if (!this.data.password || this.data.password.length < 6) {
      wx.showToast({ title: "密码至少 6 位", icon: "none" });
      return null;
    }
    if (this.data.mode === "register" && this.data.role !== "patient" && !this.data.identityCode) {
      wx.showToast({ title: "请输入身份码", icon: "none" });
      return null;
    }
    return phone;
  },

  async submitAccount() {
    if (this.data.loading) return;
    if (!this.data.agreedToTerms) {
      wx.showToast({ title: "请先阅读并同意协议", icon: "none" });
      return;
    }
    const phone = this.validateAccountForm();
    if (!phone) return;

    this.setData({ loading: true });
    try {
      const payload = {
        phone,
        password: this.data.password,
        role: this.data.role,
        identityCode: this.data.identityCode,
      };
      const res = this.data.mode === "register"
        ? await api.register(payload)
        : await api.passwordLogin(payload);
      this.saveLogin(res);
      wx.showToast({ title: this.data.mode === "register" ? "注册成功" : "登录成功" });
      this.goByRole(res.user.role);
    } catch (err) {
      wx.showToast({
        title: err?.error || "账号登录失败",
        icon: "none",
        duration: 3000,
      });
    } finally {
      this.setData({ loading: false });
    }
  },
});
