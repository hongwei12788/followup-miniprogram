# 术后随访小程序

这是一个用于医院术后随访管理的微信小程序示例，包含患者端、医生端、护士端和管理员能力。

## 主要功能

- 患者注册登录后按手机号绑定医院录入的患者档案
- 患者查看随访任务、拔管提醒、医生提醒和检查结果
- 患者提交术后恢复反馈
- 医生和护士查看自己权限范围内的患者与随访任务
- 医护上传检查结果图片和说明
- 医护记录提醒患者的消息
- 医护手动发送短信随访提醒，服务端也会每小时检查未来 24 小时内的短信随访任务
- 管理员删除患者资料、随访任务和检查结果

## 云托管环境变量

上线前请在微信云托管服务设置中配置：

```text
DATABASE_URL=file:/data/dev.db
JWT_SECRET=请替换为长随机字符串
STAFF_INVITE_CODE=医生护士注册身份码
ADMIN_INVITE_CODE=管理员注册身份码
WECHAT_APPID=小程序 AppID
WECHAT_SECRET=小程序密钥
HOSPITAL_NAME=可选默认医院名称
FOLLOWUP_DEPARTMENT_NAME=可选默认随访科室名称
TENCENT_SECRET_ID=腾讯云 API SecretId
TENCENT_SECRET_KEY=腾讯云 API SecretKey
TENCENT_SMS_SDK_APP_ID=短信 SdkAppId
TENCENT_SMS_SIGN_NAME=已审核短信签名内容
TENCENT_SMS_TEMPLATE_ID=已审核短信模板 ID
TENCENT_SMS_TEMPLATE_PARAMS=message
WECHAT_SUBSCRIBE_FOLLOWUP_TEMPLATE_ID=随访提醒订阅消息模板 ID
WECHAT_SUBSCRIBE_CATHETER_TEMPLATE_ID=拔管提醒订阅消息模板 ID
WECHAT_SUBSCRIBE_FOLLOWUP_DATA_MAP=thing14:hospitalName,thing12:departmentName,thing4:instruction,thing8:patientName,thing11:title
WECHAT_SUBSCRIBE_CATHETER_DATA_MAP=thing1:title,name2:patientName,date3:dueDate,thing4:location
WECHAT_MINIPROGRAM_STATE=formal
WECHAT_TLS_ALLOW_SELF_SIGNED=false
WECHAT_TLS_CA_CERT_BASE64=
WECHAT_TLS_CA_CERT_PEM=
```

短信模板建议先申请一个单参数通知模板，例如“您有一条术后随访提醒：{1}”。如果模板参数不同，可以把 `TENCENT_SMS_TEMPLATE_PARAMS` 配成 `patientName,title,dueDate,location,message` 这类逗号分隔顺序，和短信模板参数顺序保持一致。

微信订阅消息需要先在小程序后台申请模板。患者在首页点击开启微信提醒后，服务端会优先发送微信服务通知；未授权或发送失败时，会继续保留小程序内提醒，并在任务包含短信渠道且短信服务已配置时使用短信兜底。`WECHAT_SUBSCRIBE_*_DATA_MAP` 用于匹配模板字段，例如 `thing14:hospitalName,thing12:departmentName,thing4:instruction,thing8:patientName,thing11:title`。医院名称和随访科室优先使用新增手术记录里选择或输入的值，`HOSPITAL_NAME` 和 `FOLLOWUP_DEPARTMENT_NAME` 只作为旧数据或未填写时的默认值。

如果云托管日志或患者首页诊断卡片里出现 `self-signed certificate`、`DEPTH_ZERO_SELF_SIGNED_CERT`、`access_token_fetch`，说明服务端访问微信接口时遇到了证书链校验问题。可以先临时配置 `WECHAT_TLS_ALLOW_SELF_SIGNED=true` 做排障，重部署后再次发送微信提醒。确认问题来自证书链后，建议改用 `WECHAT_TLS_CA_CERT_BASE64` 或 `WECHAT_TLS_CA_CERT_PEM` 配置受信任 CA 证书内容。

`WECHAT_TLS_CA_CERT_BASE64` 建议填写 PEM 证书文件做 Base64 编码后的单行字符串。`WECHAT_TLS_CA_CERT_PEM` 适合直接粘贴 PEM 文本，换行需要写成 `\n`。如果同时配置了这两个变量，服务端优先使用 `WECHAT_TLS_CA_CERT_BASE64`。

## 数据持久化

Docker 镜像默认使用 `DATABASE_URL=file:/data/dev.db`，并声明 `/data` 为数据目录。部署云托管时请给服务挂载持久化存储，确保 `/data` 在重新部署后仍保留。

如果未来医院正式使用，建议把 `DATABASE_URL` 切换到云托管 MySQL 或其他托管数据库。

## 发布流程

1. 推送代码到 Gitee `master`
2. 微信云托管重新部署服务
3. 在云托管云端调试访问 `/api/health`
4. 微信开发者工具重新上传小程序
5. 在小程序后台设为体验版或提交审核
