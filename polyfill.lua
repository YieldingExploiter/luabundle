---@diagnostic disable: undefined-global, unused-local
------ https://github.com/Conglomeration/Lua/blob/main/dist/combine-fixtmp.js | https://github.com/YieldingExploiter/luabundle/blob/main/polyfill.lua
-- Adds support for more edge-case lua environments
-- Localize Globals
local __oldRequire = require;
local math = math;
local bit = bit or bit32;
local error = error;
local table = table;
local string = string;
local pairs = pairs;
local setmetatable = setmetatable;
local print = print;
local tonumber = tonumber;
local ipairs = ipairs;
local getfenv = getfenv;
local getgenv = getgenv;
-- General Polyfill
local fenv = (getfenv or function() return _ENV end)()
local package --[[fenv.package or]] = {['searchers'] = {[2] = function(p) warn('Module not bundled: ' .. p) end}}
-- Roblox Polyfill
if _VERSION == 'Luau' and game then
  __oldRequire = function() end;
  math = setmetatable({['mod'] = math.fmod}, {__index = fenv.math})
end
local require = (function(cache)
  return (function(moduleName, ...)
    -- ensure not .lua
    if string.sub(moduleName, #moduleName - 3, #moduleName):lower() == '.lua' then
      moduleName = string.sub(moduleName, 1, #moduleName - 4)
    end
    if cache[moduleName] then
      return cache[moduleName]
    else
      local module = package['searchers'][2](moduleName, ...)
      if not module then
        cache[moduleName] = __oldRequire(moduleName, ...)
      else
        cache[moduleName] = module(...)
      end
      return cache[moduleName]
    end
  end)
end)({})
