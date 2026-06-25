const api = require("../../utils/api");

Page({
  data: {
    name: "",
    phone: "",
    organizationName: "",
    organizationOptions: [],
    organizationIndex: 0,
    organizationSelected: false,
    departmentName: "",
    departmentOptions: [],
    departmentIndex: 0,
    departmentSelected: false,
    surgeryName: "",
    surgeryTime: "",
    firstFollowupTime: "",
    followupLocation: "",
    loading: false,
  },

  async onLoad() {
    await this.loadOrganizations();
  },

  async loadOrganizations() {
    try {
      const res = await api.getOrganizations();
      this.setData({ organizationOptions: res.list || [] });
    } catch (err) {
      this.setData({ organizationOptions: [] });
    }
  },

  onOrganizationInput(e) {
    this.setData({
      organizationName: e.detail.value,
      organizationIndex: 0,
      organizationSelected: false,
      departmentIndex: 0,
      departmentSelected: false,
      departmentOptions: [],
    });
  },

  onOrganizationChange(e) {
    const index = Number(e.detail.value);
    const organization = this.data.organizationOptions[index];
    this.setData({
      organizationIndex: index,
      organizationSelected: true,
      organizationName: organization?.name || "",
      departmentOptions: organization?.departments || [],
      departmentIndex: 0,
      departmentSelected: false,
      departmentName: "",
    });
  },

  onDepartmentInput(e) {
    this.setData({
      departmentName: e.detail.value,
      departmentIndex: 0,
      departmentSelected: false,
    });
  },

  onDepartmentChange(e) {
    const index = Number(e.detail.value);
    const department = this.data.departmentOptions[index];
    this.setData({
      departmentIndex: index,
      departmentSelected: true,
      departmentName: department?.name || "",
    });
  },

  onSurgeryDateChange(e) {
    this.setData({ surgeryTime: e.detail.value });
  },

  onFirstFollowupDateChange(e) {
    this.setData({ firstFollowupTime: e.detail.value });
  },

  clearFirstFollowupDate() {
    this.setData({ firstFollowupTime: "" });
  },

  async submit() {
    if (this.data.loading) return;
    if (!this.data.name || !this.data.phone || !this.data.surgeryName || !this.data.surgeryTime) {
      wx.showToast({ title: "请完善必填信息", icon: "none" });
      return;
    }

    this.setData({ loading: true });
    try {
      const patientRes = await api.createPatient({ name: this.data.name, phone: this.data.phone });
      const selectedOrganization = this.data.organizationSelected ? this.data.organizationOptions[this.data.organizationIndex] : null;
      const selectedDepartment = this.data.departmentSelected ? this.data.departmentOptions[this.data.departmentIndex] : null;
      await api.createSurgery({
        patientId: patientRes.patient.id,
        organizationId: selectedOrganization?.id,
        organizationName: this.data.organizationName,
        departmentId: selectedDepartment?.id,
        departmentName: this.data.departmentName,
        surgeryName: this.data.surgeryName,
        surgeryTime: new Date(this.data.surgeryTime).toISOString(),
        firstFollowupTime: this.data.firstFollowupTime ? new Date(this.data.firstFollowupTime).toISOString() : "",
        followupLocation: this.data.followupLocation,
      });
      wx.showToast({ title: "提交成功" });
      wx.navigateBack();
    } catch (e) {
      wx.showToast({ title: e?.error || "提交失败", icon: "none" });
      console.error(e);
    } finally {
      this.setData({ loading: false });
    }
  },
});
