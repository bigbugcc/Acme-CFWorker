export default {
  async fetch(request, env, ctx) {
    // 获取客户端 IP 地址
    const clientIP = request.headers.get('CF-Connecting-IP');

    // 从环境变量获取 IP 白名单
    const ipWhitelist = env.IP_WHITELIST || '';

    // 如果白名单不为空，检查客户端 IP 是否被允许访问
    if (ipWhitelist.trim() !== '') {
      const allowedIPs = ipWhitelist.split(',').map(ip => ip.trim());

      if (!allowedIPs.includes(clientIP)) {
        return new Response('Access denied!', {
          status: 401,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }

    // 目标 ACME 目录 URL
    const acmeDirectoryUrl = "https://dv.acme-v02.api.pki.goog/directory";
    const targetHost = "dv.acme-v02.api.pki.goog";
    const targetBaseUrl = `https://${targetHost}/`;

    // 获取请求 URL 的路径部分和当前 worker 的 host
    const url = new URL(request.url);
    let path = url.pathname + url.search;
    const proxyHost = url.host; // Your worker's domain
    const proxyBaseUrl = `https://${proxyHost}/`;

    // 定义一个函数来处理响应和替换 URL
    const processResponse = async (response) => {
      // 克隆响应头以便修改
      const responseHeaders = new Headers(response.headers);
      // 可选：添加 CORS 头
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      // 确保 content-type 正确，如果原始响应中有的话
      const contentType = response.headers.get('content-type');
      if (contentType) {
        responseHeaders.set('content-type', contentType);
      }

      // 只处理文本类型的响应 (like application/json, text/plain, etc.)
      if (contentType && (contentType.includes('json') || contentType.includes('text'))) {
        let body = await response.text();
        // 使用正则表达式进行全局替换
        const regex = new RegExp(targetBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        body = body.replace(regex, proxyBaseUrl);

        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      } else {
        // 对于非文本内容，直接返回原始响应体
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      }
    };

    // 如果请求的是根路径，直接获取 Google 的 ACME 目录并处理响应
    if (path === "/" || path === "") {
      try {
        const dirResponse = await fetch(acmeDirectoryUrl, {
          method: request.method,
          headers: request.headers
        });
        return await processResponse(dirResponse);
      } catch (error) {
         return new Response(`获取目录失败: ${error.message}`, { status: 500 });
      }
    }

    // 构建目标 URL（去除前导斜杠以避免路径问题）
    const targetUrl = new URL(path.startsWith('/') ? path.substring(1) : path, targetBaseUrl);

    // 克隆请求以保留头信息和身体
    const requestOptions = {
      method: request.method,
      headers: new Headers(request.headers),
    };
    // 移除 Host 头，让 fetch 使用目标 URL 的 host
    requestOptions.headers.delete('Host');

    // 如果有请求体，则添加
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      // Ensure content-length is set if body exists, fetch might do this automatically
      // but being explicit can help avoid issues.
      const requestBody = await request.arrayBuffer();
      requestOptions.body = requestBody;
      if (!requestOptions.headers.has('Content-Length')) {
         requestOptions.headers.set('Content-Length', requestBody.byteLength);
      }
    }

    // 转发请求到 Google ACME API
    try {
      const response = await fetch(targetUrl.toString(), requestOptions);
      // 处理响应，替换 URL
      return await processResponse(response);
    } catch (error) {
      return new Response(`代理请求失败: ${error.message}`, { status: 500 });
    }
  }
};