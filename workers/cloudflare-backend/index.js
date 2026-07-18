export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Access-Control-Allow-Headers": "*",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    
    // Simple routing
    if (request.method === "POST" && url.pathname === "/register") {
      try {
        const { username, password, nickname, gender } = await request.json();
        
        if (!username || !password || !nickname || !gender) {
          return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: corsHeaders });
        }

        // Check if user already exists
        const existingUser = await env.SPORTIFY_USERS.get(`user:${username}`);
        if (existingUser) {
          return new Response(JSON.stringify({ error: "Username already registered" }), { status: 409, headers: corsHeaders });
        }

        // Save user to KV with readable dates
        const now = new Date().toISOString();
        const userData = { 
          username, 
          password, 
          nickname, 
          gender, 
          pin: "0000", 
          role: 'user', 
          joinedAt: now,
          lastActive: now
        };
        await env.SPORTIFY_USERS.put(`user:${username}`, JSON.stringify(userData));

        return new Response(JSON.stringify({ success: true, message: "Account created securely!" }), { status: 200, headers: corsHeaders });

      } catch (err) {
        return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: corsHeaders });
      }
    }

    if (request.method === "POST" && url.pathname === "/login") {
      try {
        const { username, password } = await request.json();

        if (!username || !password) {
          return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: corsHeaders });
        }

        const userStr = await env.SPORTIFY_USERS.get(`user:${username}`);
        if (!userStr) {
          return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: corsHeaders });
        }

        const user = JSON.parse(userStr);
        if (user.password !== password) {
          return new Response(JSON.stringify({ error: "Incorrect password" }), { status: 401, headers: corsHeaders });
        }

        // Update lastActive
        user.lastActive = new Date().toISOString();
        await env.SPORTIFY_USERS.put(`user:${username}`, JSON.stringify(user));

        return new Response(JSON.stringify({ 
          success: true, 
          token: "mock_jwt_token_for_session",
          username: user.username,
          pin: user.pin || "0000" // Default for older accounts
        }), { status: 200, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: corsHeaders });
      }
    }

    if (request.method === "POST" && url.pathname === "/update-pin") {
      try {
        const { username, oldPin, newPin } = await request.json();
        if (!username || !oldPin || !newPin) {
          return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: corsHeaders });
        }

        const userStr = await env.SPORTIFY_USERS.get(`user:${username}`);
        if (!userStr) {
          return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
        }
        
        const user = JSON.parse(userStr);
        if (user.pin !== oldPin && user.pin !== undefined) {
           // Allow setting new pin if it wasn't set previously (undefined), otherwise check old pin
           return new Response(JSON.stringify({ error: "Incorrect current PIN" }), { status: 401, headers: corsHeaders });
        }
        
        user.pin = newPin;
        await env.SPORTIFY_USERS.put(`user:${username}`, JSON.stringify(user));
        return new Response(JSON.stringify({ success: true, message: "PIN updated" }), { status: 200, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: corsHeaders });
      }
    }

    if (request.method === "GET" && url.pathname === "/favorites") {
      try {
        const username = url.searchParams.get("username");
        if (!username) {
          return new Response(JSON.stringify({ error: "Missing username" }), { status: 400, headers: corsHeaders });
        }
        
        const userExists = await env.SPORTIFY_USERS.get(`user:${username}`);
        if (!userExists) {
          await env.SPORTIFY_USERS.delete(`fav:${username}`);
          return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
        }

        const favStr = await env.SPORTIFY_USERS.get(`fav:${username}`);
        const favorites = favStr ? JSON.parse(favStr) : [];
        return new Response(JSON.stringify({ success: true, favorites }), { status: 200, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: corsHeaders });
      }
    }

    if (request.method === "POST" && url.pathname === "/favorites") {
      try {
        const { username, favorites } = await request.json();
        if (!username || !Array.isArray(favorites)) {
          return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: corsHeaders });
        }
        
        const userExists = await env.SPORTIFY_USERS.get(`user:${username}`);
        if (!userExists) {
          await env.SPORTIFY_USERS.delete(`fav:${username}`);
          return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
        }

        await env.SPORTIFY_USERS.put(`fav:${username}`, JSON.stringify(favorites));
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: corsHeaders });
      }
    }

    if (request.method === "POST" && url.pathname === "/get-user-data") {
      try {
        const { username } = await request.json();
        if (!username) return new Response(JSON.stringify({ error: "Missing username" }), { status: 400, headers: corsHeaders });
        
        const rawData = await env.SPORTIFY_USERS.get(`data:${username}`);
        let userData = { favorites: [], watchHistory: [] };
        if (rawData) userData = JSON.parse(rawData);
        
        return new Response(JSON.stringify(userData), { status: 200, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: corsHeaders });
      }
    }

    if (request.method === "POST" && url.pathname === "/update-user-data") {
      try {
        const { username, data } = await request.json();
        if (!username || !data) return new Response(JSON.stringify({ error: "Missing payload" }), { status: 400, headers: corsHeaders });
        
        await env.SPORTIFY_USERS.put(`data:${username}`, JSON.stringify(data));
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: corsHeaders });
      }
    }

    if (request.method === "POST" && url.pathname === "/update-last-active") {
      try {
        const { username } = await request.json();
        if (!username) return new Response(JSON.stringify({ error: "Missing username" }), { status: 400, headers: corsHeaders });
        
        const userStr = await env.SPORTIFY_USERS.get(`user:${username}`);
        if (!userStr) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
        
        const user = JSON.parse(userStr);
        user.lastActive = new Date().toISOString();
        await env.SPORTIFY_USERS.put(`user:${username}`, JSON.stringify(user));
        
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: corsHeaders });
      }
    }

    if (request.method === "POST" && url.pathname === "/get-profile") {
      try {
        const { username } = await request.json();
        if (!username) return new Response(JSON.stringify({ error: "Missing username" }), { status: 400, headers: corsHeaders });
        
        const userStr = await env.SPORTIFY_USERS.get(`user:${username}`);
        if (!userStr) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
        
        const user = JSON.parse(userStr);
        return new Response(JSON.stringify({
          nickname: user.nickname || username,
          joinedAt: user.joinedAt || new Date().toISOString(),
          avatar: user.avatar || null
        }), { status: 200, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: corsHeaders });
      }
    }

    if (request.method === "POST" && url.pathname === "/update-profile") {
      try {
        const { username, nickname, avatar } = await request.json();
        if (!username) return new Response(JSON.stringify({ error: "Missing username" }), { status: 400, headers: corsHeaders });
        
        const userStr = await env.SPORTIFY_USERS.get(`user:${username}`);
        if (!userStr) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
        
        const user = JSON.parse(userStr);
        if (nickname) user.nickname = nickname;
        if (avatar) user.avatar = avatar;
        
        await env.SPORTIFY_USERS.put(`user:${username}`, JSON.stringify(user));
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ error: "Endpoint not found" }), { status: 404, headers: corsHeaders });
  },
};
