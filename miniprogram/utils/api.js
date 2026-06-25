const app = getApp();

function request(options) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject({ error: "请求超时，请检查网络后重试" });
      }
    }, options.timeout || 15000);

    wx.cloud.callContainer({
      config: {
        env: app.globalData.cloudEnv,
      },
      path: options.url,
      method: options.method || "GET",
      data: options.data || {},
      header: {
        "content-type": "application/json",
        "X-WX-SERVICE": app.globalData.cloudService,
        Authorization: "Bearer " + (app.globalData.token || ""),
      },
      success(res) {
        settled = true;
        clearTimeout(timer);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          wx.removeStorageSync("token");
          app.globalData.token = null;
          reject({ error: "登录已过期，请重新登录" });
        } else {
          reject(res.data || res);
        }
      },
      fail(err) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      },
    });
  });
}

function uploadCloudFile(localPath, folder) {
  const ext = localPath.split(".").pop() || "jpg";
  return wx.cloud.uploadFile({
    cloudPath: `${folder}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`,
    filePath: localPath,
  });
}

module.exports = {
  uploadCloudFile,
  login(data) { return request({ url: "/api/auth/wechat-login", method: "POST", data }); },
  register(data) { return request({ url: "/api/auth/register", method: "POST", data }); },
  passwordLogin(data) { return request({ url: "/api/auth/password-login", method: "POST", data }); },
  setRole(data) { return request({ url: "/api/auth/role", method: "POST", data }); },
  getLoginInfo() { return request({ url: "/api/auth/login-info" }); },
  updateProfile(data) { return request({ url: "/api/auth/profile", method: "POST", data }); },
  bindPhone(data) { return request({ url: "/api/auth/bind-phone", method: "POST", data }); },
  getMe() { return request({ url: "/api/me" }); },
  getFeatureConfig() { return request({ url: "/api/config/features" }); },
  getWechatSubscribeTemplates() { return request({ url: "/api/wechat-subscribe/templates" }); },
  getWechatSubscribeStatus() { return request({ url: "/api/wechat-subscribe/status" }); },
  saveWechatSubscribeResults(data) { return request({ url: "/api/wechat-subscribe/results", method: "POST", data }); },
  getOrganizations() { return request({ url: "/api/organizations" }); },
  getPatients(query) { return request({ url: "/api/patients", data: query }); },
  createPatient(data) { return request({ url: "/api/patients", method: "POST", data }); },
  getPatient(id) { return request({ url: "/api/patients/" + id }); },
  deletePatient(id) { return request({ url: "/api/patients/" + id, method: "DELETE" }); },
  sendPatientReminder(id, data) { return request({ url: "/api/patients/" + id + "/reminders", method: "POST", data }); },
  getWechatReminderDiagnosis(id) { return request({ url: "/api/patients/" + id + "/wechat-reminder-diagnosis" }); },
  createSurgery(data) { return request({ url: "/api/surgeries", method: "POST", data }); },
  getSurgeries(patientId) { return request({ url: "/api/patients/" + patientId + "/surgeries" }); },
  deleteSurgery(id) { return request({ url: "/api/surgeries/" + id, method: "DELETE" }); },
  getFollowupTasks(query) { return request({ url: "/api/followup-tasks", data: query }); },
  updateTaskStatus(id, data) { return request({ url: "/api/followup-tasks/" + id + "/status", method: "PATCH", data }); },
  deleteTask(id) { return request({ url: "/api/followup-tasks/" + id, method: "DELETE" }); },
  remindTask(id, data) { return request({ url: "/api/followup-tasks/" + id + "/remind", method: "POST", data }); },
  submitRecord(id, data) { return request({ url: "/api/followup-tasks/" + id + "/records", method: "POST", data }); },
  getMyTasks() { return request({ url: "/api/patient/followup-tasks" }); },
  getMyReminders() { return request({ url: "/api/patient/reminders" }); },
  getExaminationResults(patientId) { return request({ url: "/api/patients/" + patientId + "/examination-results" }); },
  createExaminationResult(patientId, data) { return request({ url: "/api/patients/" + patientId + "/examination-results", method: "POST", data }); },
  deleteExaminationResult(patientId, resultId) { return request({ url: "/api/patients/" + patientId + "/examination-results/" + resultId, method: "DELETE" }); },
  getDashboard() { return request({ url: "/api/dashboard/staff" }); },
  getTemplates() { return request({ url: "/api/followup-templates" }); },
};
