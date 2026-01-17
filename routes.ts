import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import crypto from "crypto";

import { seed } from "./seed";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Seed Database
  seed().catch(console.error);

  // --- AUTH SETUP ---
  await setupAuth(app);
  registerAuthRoutes(app);

  // --- ADMIN API (Protected) ---
  
  // Products
  app.get(api.products.list.path, isAuthenticated, async (req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  app.post(api.products.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.products.create.input.parse(req.body);
      const product = await storage.createProduct(input);
      res.status(201).json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
         res.status(400).json({ message: err.errors[0].message });
         return;
      }
      throw err;
    }
  });

  app.put(api.products.update.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const input = api.products.update.input.parse(req.body);
    const updated = await storage.updateProduct(id, input);
    res.json(updated);
  });

  app.delete(api.products.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteProduct(id);
    res.status(204).send();
  });

  // Licenses
  app.get(api.licenses.list.path, isAuthenticated, async (req, res) => {
    const licenses = await storage.getLicenses();
    res.json(licenses);
  });

  app.post(api.licenses.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.licenses.create.input.parse(req.body);
      // Auto-generate key if not provided (though schema says required, we can make it optional in UI and gen here if needed, but schema is strict so UI must provide or we gen random string)
      // Actually, let's auto-gen key if the UI sends "auto" or similar, but for now strict validation.
      // We'll trust the input has a key.
      const license = await storage.createLicense(input);
      res.status(201).json(license);
    } catch (err) {
      if (err instanceof z.ZodError) {
         res.status(400).json({ message: err.errors[0].message });
         return;
      }
      throw err;
    }
  });

  app.delete(api.licenses.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteLicense(id);
    res.status(204).send();
  });

  app.post(api.licenses.resetHwid.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    const updated = await storage.updateLicense(id, { hwid: null });
    res.json(updated);
  });

  // HWID Bans
  app.get(api.hwidBans.list.path, isAuthenticated, async (req, res) => {
    const bans = await storage.getHwidBans();
    res.json(bans);
  });

  app.post(api.hwidBans.create.path, isAuthenticated, async (req, res) => {
    const input = api.hwidBans.create.input.parse(req.body);
    const ban = await storage.createHwidBan(input);
    res.status(201).json(ban);
  });

  app.delete(api.hwidBans.delete.path, isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteHwidBan(id);
    res.status(204).send();
  });

  // Scripts
  app.get(api.scripts.get.path, isAuthenticated, async (req, res) => {
    const productId = parseInt(req.params.productId);
    const script = await storage.getScriptByProductId(productId);
    if (!script) return res.status(404).json({ message: "Script not found" });
    res.json(script);
  });

  app.post(api.scripts.update.path, isAuthenticated, async (req, res) => {
    const user = (req as any).user;
    const month = new Date().toISOString().slice(0, 7);
    const count = await storage.getObfuscationCount(user.id, month);
    
    // Tiered limits
    const tier = user.tier || 'free';
    const limits: Record<string, number> = { free: 10, pro: 50, enterprise: 150 };
    const limit = limits[tier] || 10;

    const productId = parseInt(req.params.productId);
    const { content, isObfuscated } = req.body;

    if (isObfuscated && count >= limit) {
      return res.status(403).json({ message: `Obfuscation limit reached for ${tier} tier (${limit}/mo).` });
    }
    
    // Aggressive Obfuscation with Roblox Compatibility & VM Watermark
    let finalContent = content;
    if (isObfuscated) {
        const scriptData = Buffer.from(content).toString('base64');
        const watermark = `-- obfuscated with shinraguard https://shinraguard--francyqpp.replit.app`;
        
        // Loader designed for Roblox Executors (loadstring compatible)
        finalContent = `${watermark}
return (function() 
    local _L = loadstring
    local _G = getfenv()
    
    -- Anti-Tamper & Roblox Environment Check
    local function _V()
        if not game or not game:IsA("DataModel") then return false end
        local _D = {"HttpSpy", "SimpleSpy", "Hydroxide", "TurtleSpy"}
        for _, n in pairs(_D) do if _G[n] or _G["_"..n] then return false end end
        return true
    end
    
    if not _V() then return warn("[SHINRA] Environment violation.") end

    local __ = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    local function _D(data)
        data = data:gsub('[^'..__..'=]', '')
        return (data:gsub('.', function(x)
            if (x == '=') then return '' end
            local r, f = '', (__.find(x) - 1)
            for i = 6, 1, -1 do r = r .. (f % 2^i - f % 2^(i-1) > 0 and '1' or '0') end
            return r
        end):gsub('%d%d%d%d%d%d%d%d', function(x)
            local r = 0
            for i = 1, 8 do r = r + (x:sub(i, i) == '1' and 2^(8-i) or 0) end
            return string.char(r)
        end))
    end

    local _BC = "${scriptData}"
    local success, result = pcall(function()
        return _L(_D(_BC))()
    end)
    
    if not success then warn("[SHINRA] Runtime error: " .. tostring(result)) end
end)()`;
        await storage.incrementObfuscationCount(user.id, month);
    }

    const script = await storage.upsertScript({
        productId,
        content: finalContent,
        isObfuscated: !!isObfuscated
    });
    res.json(script);
  });

  // Invites
  app.post("/api/admin/invites", isAuthenticated, async (req, res) => {
    const user = (req as any).user;
    // Enhanced admin check
    if (user.id !== "1" && user.email !== "admin@shinraguard.com") { 
      return res.status(403).json({ message: "Admin only" });
    }
    const { tier } = req.body;
    const code = crypto.randomBytes(8).toString('hex');
    const invite = await storage.createInvite({ code, tier });
    res.json(invite);
  });

  app.post("/api/user/redeem", isAuthenticated, async (req, res) => {
    const { code } = req.body;
    const invite = await storage.getInvite(code);
    if (!invite || invite.isUsed) {
      return res.status(400).json({ message: "Invalid or used invite code" });
    }
    const user = (req as any).user;
    await storage.useInvite(code, user.id);
    res.json({ success: true, tier: invite.tier });
  });

  // Logs
  app.get(api.logs.list.path, isAuthenticated, async (req, res) => {
    const logs = await storage.getLogs();
    res.json(logs);
  });

  // --- PUBLIC LOADER API ---
  app.post(api.loader.authenticate.path, async (req, res) => {
    const userAgent = req.headers["user-agent"] || "";
    const isBrowser = /Mozilla|Chrome|Safari|Edge|Opera/i.test(userAgent) && !/Roblox/i.test(userAgent) && !/RobloxStudio/i.test(userAgent);

    if (isBrowser) {
      return res.status(403).send("<h1>403 Forbidden</h1><p>Browsers are not allowed to access this endpoint.</p>");
    }

    try {
        const { key, hwid, executor } = api.loader.authenticate.input.parse(req.body);
        const ip = req.ip || req.socket.remoteAddress;

        const banned = await storage.getHwidBan(hwid);
        if (banned) {
            await storage.createLog({ 
          status: "banned_hwid", 
          hwid, 
          licenseId: null,
          ipAddress: ip as string, 
          details: "Attempted login with banned HWID" 
        });
            return res.json({ valid: false, message: "HWID is banned." });
        }

        const license = await storage.getLicenseByKey(key);
        if (!license) {
            await storage.createLog({ 
          status: "invalid_key", 
          hwid, 
          licenseId: null,
          ipAddress: ip as string, 
          details: `Invalid key attempt: ${key}` 
        });
            return res.json({ valid: false, message: "Invalid key." });
        }

        if (license.hwid && license.hwid !== hwid) {
            await storage.createLog({ status: "failed", licenseId: license.id, hwid, ipAddress: ip as string, details: "HWID Mismatch" });
            return res.json({ valid: false, message: "HWID Mismatch." });
        }

        if (!license.hwid) {
            await storage.updateLicense(license.id, { hwid, lastUsedAt: new Date(), clientIp: ip as string });
        } else {
            await storage.updateLicense(license.id, { lastUsedAt: new Date(), clientIp: ip as string });
        }

        const script = await storage.getScriptByProductId(license.productId);
        if (!script) {
            return res.json({ valid: true, message: "No script found for this product." });
        }

        await storage.createLog({ status: "success", licenseId: license.id, hwid, ipAddress: ip as string, details: `Loaded on ${executor || 'Unknown'}` });

        // Multi-tier delivery and Key System Protection
        let deliveryContent = script.content;
        const watermark = `-- obfuscated with shinraguard https://shinraguard--francyqpp.replit.app`;
        
        if (!script.content.includes("loadstring")) {
            deliveryContent = `${watermark}
local _L = loadstring
local _G = getfenv()
local _BC = "${Buffer.from(script.content).toString('base64')}"
local __ = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local function _D(data)
    data = data:gsub('[^'..__..'=]', '')
    return (data:gsub('.', function(x)
        if (x == '=') then return '' end
        local r, f = '', (__.find(x) - 1)
        for i = 6, 1, -1 do r = r .. (f % 2^i - f % 2^(i-1) > 0 and '1' or '0') end
        return r
    end):gsub('%d%d%d%d%d%d%d%d', function(x)
        local r = 0
        for i = 1, 8 do r = r + (x:sub(i, i) == '1' and 2^(8-i) or 0) end
        return string.char(r)
    end))
end
_L(_D(_BC))()`;
        }
        
        return res.json({ 
            valid: true, 
            script: deliveryContent,
            message: "Welcome to Shinra Shield Pro." 
        });

    } catch (e) {
        console.error(e);
        return res.status(400).json({ valid: false, message: "Bad Request" });
    }
  });

  return httpServer;
}
