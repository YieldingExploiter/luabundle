# LuaBundle

Use LuaCC to bundle Lua files into a single file.

## Installation

```bash
pnpm i -g luaccbundle
```

## Usage

```bash
luaccbundle [directory: .] [index: init.lua] [output: bundle.lua]
```

### NOTICE

This ships with it's own Lua version.

You cannot require the index file.

This does not perform tree shaking.

---

Made with help from Mokiy
