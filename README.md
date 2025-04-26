# Acme-CFWorker

## 项目简介
Acme-CFWorker 是一个基于 Cloudflare Worker 的轻量代理，用于与 Google 的 ACME API 进行通信。代理能够转发 HTTP 请求至 Google ACME API，申请或访问 SSL 证书相关服务。

## 核心功能
- **动态路径代理**：根据请求路径构造目标 URL，智能转发请求至 Google ACME 服务。
- **IP白名单**：仅允许特定IP地址访问。
- **CORS 支持**：自动在响应中添加 `Access-Control-Allow-Origin: *` 头，方便跨域访问。
- **透明代理**：完整保留原始请求的 HTTP 方法、头部以及请求体，提高数据传输的准确性。
- **错误处理**：在请求转发时捕获异常，确保在代理出错时返回明确的错误信息。

## 部署说明
1. 登录 Cloudflare Workers 管理平台。
2. 新建或编辑 Worker，将 `worker.js` 文件中的代码部署到 Worker 服务中。
3. 配置自定义域名或路由，以使用该代理服务。
4. IP白名单设置在对应Worker -> 设置 -> 变量 -> 添加变量名 "IP_WHITELIST"，多个IP用英文逗号隔开。

## 使用示例
- **根路径请求**：
  - 请求：`GET /`
  - 响应：返回 Google ACME 目录信息。
  
- **动态路径请求**：
  - 请求：`GET /some-endpoint`
  - 响应：转发请求至 `https://dv.acme-v02.api.pki.goog/some-endpoint` 并返回其响应。

## 核心代码解析
在 `worker.js` 文件中，主要实现步骤包括：

1. **请求路径处理**
   - 当请求的路径为根路径 (`/` 或空字符串) 时，直接返回 Google ACME 目录的内容。
   ```javascript
   if (path === "/" || path === "") {
     return fetch(acmeDirectoryUrl, {
       method: request.method,
       headers: request.headers
     });
   }
   ```

2. **目标 URL 构建**
   - 对于非根路径的请求，将去除路径首部的斜杠，并以此构造新的目标 URL。
   ```javascript
   const targetUrl = new URL(path.startsWith('/') ? path.substring(1) : path, 'https://dv.acme-v02.api.pki.goog/');
   ```

3. **请求转发**
   - 根据原始请求创建一个新的请求选项对象，并保留请求的所有头部和请求体（适用于 POST、PUT、PATCH 方法），然后将请求转发至构造出的目标 URL。
   ```javascript
   let response = await fetch(targetUrl.toString(), requestOptions);
   ```

4. **响应构建与错误处理**
   - 在获取响应后，为响应添加 CORS 头，并返回给客户端。如果出现错误，则返回 500 状态码及错误信息。
   ```javascript
   responseHeaders.set('Access-Control-Allow-Origin', '*');
   return new Response(response.body, {
     status: response.status,
     statusText: response.statusText,
     headers: responseHeaders
   });
   ```

## 许可证
本项目遵循 MIT 许可证。