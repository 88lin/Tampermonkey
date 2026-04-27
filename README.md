# Tampermonkey Scripts

当前仓库主要维护自用油猴脚本。本文先记录 `Microsoft-Rewards.user.js` 的使用方式和功能说明。

## Microsoft Rewards 自动任务脚本

`Microsoft-Rewards.user.js` 用于在浏览器中自动完成 Microsoft Rewards 日常任务，包含签入、阅读、活动和搜索。脚本会在 Bing 页面加载时触发运行，并在任务完成后记录当天状态，避免重复执行。

> 脚本仅供学习和自用。Microsoft Rewards 规则可能变化，使用前请自行确认账号风险。

## 支持功能

- 自动签入：调用 Microsoft Rewards 移动端接口完成每日签入。
- 自动阅读：完成阅读文章任务，按接口返回进度补足阅读次数。
- 自动活动：识别并完成 Rewards Dashboard 和 Earn 页面中的每日活动任务。
- 自动搜索：模拟桌面端和移动端 Bing 搜索，自动补足搜索积分。
- 授权码自动捕获：登录授权回调到 `login.live.com/oauth20_desktop.srf` 时自动保存授权码。
- 搜索词来源：支持离线随机词，也支持多个热搜接口。
- 国区锁定：开启后检测到当前 IP 非中国大陆地区会停止运行。
- 完成状态记录：当天全部任务完成后再次打开 Bing 页面不会重复启动任务流程。
- 消息推送：支持浏览器通知、企业微信、钉钉、飞书、PushMe、Bark。

## 推荐的脚本管理器

推荐使用脚本猫。脚本包含 `@crontab */20 * * * *` 元数据，脚本猫可以按计划定时运行，更符合这个脚本“后台自动做日常任务”的使用方式。

需要注意：

- 脚本猫：推荐使用，可按 `@crontab` 定时触发。
- Tampermonkey：可以使用，但不支持 `@crontab`，需要打开 Bing 页面触发脚本。
- 如果今天任务已全部完成，再次打开或搜索 Bing 时脚本会直接退出，不会重复启动任务流程。

## 安装方式

### 脚本猫

1. 安装浏览器扩展脚本猫。
2. 在脚本猫中新建脚本。
3. 将 `Microsoft-Rewards.user.js` 的内容粘贴进去并保存。
4. 确认脚本启用，并允许脚本按 `@crontab` 定时运行。
5. 首次使用建议先手动运行一次，确认授权、登录态和通知配置正常。

### Tampermonkey

1. 安装浏览器扩展 Tampermonkey。
2. 在 Tampermonkey 中新建脚本。
3. 将 `Microsoft-Rewards.user.js` 的内容粘贴进去并保存。
4. 打开 `https://www.bing.com` 或 `https://cn.bing.com`，脚本会在页面加载时开始初始化。
5. Tampermonkey 不支持 `@crontab`，后续仍需要通过打开 Bing 页面触发运行。

## 首次使用

1. 确认浏览器已经登录 Microsoft 账号。
2. 确认 `https://rewards.bing.com` 可以正常打开，并且账号已加入 Microsoft Rewards。
3. 如果使用脚本猫，可以手动运行一次脚本；如果使用 Tampermonkey，打开 Bing 页面触发脚本。
4. 如果签入或阅读需要授权，脚本会自动打开 Microsoft 授权页面。
5. 授权成功后，回调页面会自动保存授权码并关闭。
6. 脚本会继续获取 token，并执行已启用的任务。

如果自动授权没有完成，可以手动把授权回调链接填入配置里的 `授权码链接`。格式类似：

```text
https://login.live.com/oauth20_desktop.srf?code=M.C540_BAY.2.U.xxxxxxxx
```

不要分享该链接，里面包含可用于换取 token 的授权信息。

## 配置项

### Config

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| 持续检测 | 开启 | 开启时即使任务已完成也保留检测逻辑；脚本已额外处理普通 Bing 页面重复启动问题。 |
| 锁定国区 | 开启 | 当前 IP 非中国大陆地区时停止运行。 |
| 搜索间隔 | 30 | 搜索间隔基准值，实际间隔为 `基准值 ± 15 秒`。最低 30 秒。 |
| 搜索词接口 | `hot.nntool.cc` | 搜索词来源。可选 `offline`、`hot.nntool.cc`、`hot.baiwumm.com`、`hot.cnxiaobai.com`。 |
| 授权码链接 | 空 | 签入和阅读使用的 Microsoft 授权码链接。通常由脚本自动捕获。 |

### Tasks

| 任务 | 默认值 | 说明 |
| --- | --- | --- |
| 签入 | 开启 | 需要 Authorization Code / token。 |
| 阅读 | 开启 | 需要 Authorization Code / token。 |
| 活动 | 开启 | 依赖 `rewards.bing.com` 登录状态。 |
| 搜索 | 开启 | 依赖 Bing 登录状态和 Rewards 搜索积分规则。 |

### Notice

| 渠道 | 默认值 | 说明 |
| --- | --- | --- |
| 浏览器通知 | 开启 | 使用 Tampermonkey 浏览器通知。 |
| 企业微信 | 空 | 填群机器人 key。 |
| 钉钉 | 空 | 填群机器人 access token，不加签，关键词为 `#`。 |
| 飞书 | 空 | 填群机器人 webhook key。 |
| PushMe | 空 | 填 `push.i-i.me` 的 push key。 |
| Bark | 空 | 填 Bark key。 |

## 运行逻辑

脚本入口包括：

- `http*://bing.com/*`
- `http*://*.bing.com/*`
- `https://login.live.com/oauth20_desktop.srf*`

在脚本猫中，脚本可按 `@crontab */20 * * * *` 定时运行。在 Tampermonkey 中，打开 Bing 页面会触发脚本。

脚本会读取本地保存的任务日期，如果当天所有已启用任务都完成，并且已经发送过完成汇总，就直接退出。

未完成时，脚本会：

1. 删除部分 Bing 搜索相关 cookie，降低搜索状态干扰。
2. 检查日期和任务完成状态。
3. 检查 Bing 地区和国区锁定状态。
4. 尝试续期或获取 Microsoft Rewards token。
5. 获取 Rewards 积分和任务进度。
6. 按配置启动签入、阅读、活动、搜索任务。
7. 任务完成后保存当天状态并推送结果。

## 常见问题

### 推荐用脚本猫还是 Tampermonkey？

更推荐脚本猫，因为它支持 `@crontab` 定时运行，脚本可以更接近后台任务。Tampermonkey 也能用，但需要打开 Bing 页面触发。

### Tampermonkey 为什么不能自动定时运行？

Tampermonkey 不支持脚本元数据里的 `@crontab`。它只能在匹配页面加载时运行，所以需要打开 Bing 页面触发脚本。

### 今天任务完成后，再搜索 Bing 会不会重复运行？

脚本已经做了保护。当天所有启用任务完成并记录完成汇总后，普通 Bing 页面会直接退出，不再启动任务流程。

### 为什么提示 `请检查 rewards.bing.com 是否登录`？

通常是浏览器没有登录 Microsoft Rewards，或者登录态过期。先手动打开 `https://rewards.bing.com`，确认能看到积分和任务页面。

### 为什么签入或阅读失败？

签入和阅读依赖 Microsoft 授权 token。可以尝试：

- 删除配置中的旧授权码。
- 重新打开 Bing 页面，让脚本自动打开授权页面。
- 手动完成授权后确认回调页面被脚本捕获。

### 为什么搜索积分不增长？

可能原因包括：

- 当前账号当天搜索积分已满。
- Bing 或 Rewards 页面登录态异常。
- 搜索过快或触发限制。
- 当前地区、IP 或账号规则不支持对应积分任务。

脚本会检测搜索进度，如果连续多轮进度不变，会停止本轮搜索。

### 非中国大陆 IP 会怎样？

默认开启国区锁定。脚本检测到当前 IP 非中国大陆地区时会停止运行，并通过已配置的通知渠道推送提示。

## 文件

- `Microsoft-Rewards.user.js`：Microsoft Rewards 自动任务脚本。
- `LICENSE`：项目许可证。
