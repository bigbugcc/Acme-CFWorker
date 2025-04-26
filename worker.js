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
    
    // 获取请求 URL 的路径部分
    const url = new URL(request.url);
    let path = url.pathname + url.search;
    
    // 如果请求的是根路径，直接返回 Google 的 ACME 目录
    if (path === "/" || path === "") {
      return fetch(acmeDirectoryUrl, {
        method: request.method,
        headers: request.headers
      });
    }
    
    // 构建目标 URL（去除前导斜杠以避免路径问题）
    const targetUrl = new URL(path.startsWith('/') ? path.substring(1) : path, 'https://dv.acme-v02.api.pki.goog/');
    
    // 克隆请求以保留头信息和身体
    const requestOptions = {
      method: request.method,
      headers: new Headers(request.headers),
    };
    
    // 如果有请求体，则添加
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      requestOptions.body = await request.arrayBuffer();
    }
    
    // 转发请求到 Google ACME API
    let response;
    try {
      response = await fetch(targetUrl.toString(), requestOptions);
      
      // 构建返回响应
      const responseHeaders = new Headers(response.headers);
      // 可选：添加 CORS 头
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    } catch (error) {
      return new Response(`代理请求失败: ${error.message}`, { status: 500 });
    }
  }
};