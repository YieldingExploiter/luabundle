/*
  Lua Bundler using LuaCC
  Copyright (C) 2022  Yielding#3961

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as
  published by the Free Software Foundation, either version 3 of the
  License, or (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
  */
(async()=>{
// Define Errors
  class InvalidInputError extends Error {
    constructor(message) {
      super(message);
      this.name = 'InvalidInputError';
    }
  }
  class FileNotFoundError extends Error {
    constructor(message) {
      super(`Could not find required file: ${message}`);
      this.name = 'InvalidInputError';
    }
  }

  // Get Arguments
  const args = require('yargs')
    .command('luabundle <dir> <index> <output>', 'Bundle', (yargs) => {
      yargs
        .positional('dir', {
          'describe': 'Directory to bundle',
          'type': 'string',
          'default': '.'
        })
        .positional('index', {
          'describe': 'Index (relative to cwd)',
          'type': 'string',
          'default': 'init.lua'
        })
        .positional('output', {
          'describe': 'Output file',
          'type': 'string',
          'default': 'bundle.lua'
        });
    })
    .help()
    .argv;

  // Load Listr
  const listr = require('listr');
  const Tasks = new listr;

  // Load Dependencies
  const crypto = require('crypto');
  const exec = await import('execa');

  // Prepare stuff
  const path = require('path'), fs = require('fs-extra');
  const { Observable } = require('rxjs');
  let [
    dir, idx, out
  ] = args._;
  dir = path.resolve(dir ?? '.');
  idx = path.resolve(idx ?? 'init.lua');
  out = path.resolve(out ?? 'bundle.lua');

  // Check Directories & Files
  Tasks.add({
    'title': 'Ensure Input/Output Files',
    'task': () => {
      if (!fs.existsSync(dir))
        throw new InvalidInputError('Directory does not exist');
      if (!fs.existsSync(idx))
        throw new InvalidInputError('Index file does not exist');
      if (!fs.existsSync(path.resolve(out, '..')))
        return new Observable(observer => {
          observer.next('Output File\'s Parent Directory does not exist, creating...');
          fs.ensureDirSync(path.resolve(out, '..'));
          setTimeout(() => observer.complete(), 500);
        });
    }
  });

  // Resolve Lua Path
  const LuaPath = path.resolve(__dirname, 'lua', 'bin', `lua54${process.platform === 'win32' ? '.exe' : ''}`);
  // Resolve LuaCC Path
  const LuaCCPath = path.resolve(__dirname, 'lua', 'luacc.lua');
  // Resolve Polyfill Path
  const PolyfillPath = path.resolve(__dirname, 'polyfill.lua');

  // Check Dependencies
  Tasks.add({
    'title': 'Ensure Dependencies are present',
    'task': () => {
      if (!fs.existsSync(LuaPath))
        throw new FileNotFoundError(LuaPath);
      if (!fs.existsSync(LuaCCPath))
        throw new FileNotFoundError(LuaCCPath);
      if (!fs.existsSync(PolyfillPath))
        throw new FileNotFoundError(PolyfillPath);
    }
  });

  // Get all files & generate LuaCC command
  let files = [];
  let luaccCommand;
  const ignorefile = path.resolve(process.cwd(), '.luabundlerignore');
  const ignore = fs.existsSync(ignorefile) ? fs.readFileSync(ignorefile, 'utf8').split('\n')
    .filter(x => x.length > 0 && !x.startsWith('#'))
    .map(x=>x.trim())
    .map(x=>x.endsWith('.lua') ? x : `${x}.lua`) : ['test.lua'];
  Tasks.add({
    'title': 'Prepare Luacc',
    'task': () => new listr([
      {
        'title': 'Remove old output',
        'skip': () => !fs.existsSync(out),
        'task': () => fs.rmSync(out)
      },
      {
        'title': 'Get Lua Files',
        'task': () => new Observable(observer => {
          const recurse = (d)=>{
            observer.next(`Read Directory ${d}`);
            for (let i of fs.readdirSync(d)) {
              i = path.resolve(d, i);
              const stat = fs.statSync(i);
              if (stat.isDirectory())
                recurse(i);
              else {
                const f = i.replace(`${dir}${process.platform === 'win32' ? '\\' : '/'}`, '').split('\\')
                  .join('/');
                if (ignore.includes(f))
                  observer.next(`Skipping File ${f}`);
                else {
                  observer.next(`Addding File ${f}`);
                  files.push(f);
                }
              }
            }
          };
          recurse(dir);
          files = files.filter(i=>i.endsWith('.lua')).map(i=>i.replace('.lua', ''));
          setTimeout(()=>observer.complete(), 250);
        })
      },
      {
        'title': 'Generate luacc Command',
        'task': () => new Observable(observer => {
          const r = x=>path.relative(dir, x);
          luaccCommand = `"${LuaPath}" "${LuaCCPath}" "${r(idx.replace('.lua', ''))}" ${files.filter(i=>i !== r(idx.replace('.lua', ''))).map(i => `"${i}"`)
            .join(' ')
            .split('\\')
            .join('/')} -o "${out}"`;
          setTimeout(()=>observer.complete(), 250);
        })
      }
    ])
  });

  // Bundle
  Tasks.add({
    'title': 'Bundle using Luacc',
    'task': () => exec.execa(luaccCommand, {
      'shell': true,
      'cwd': dir
    })
  });

  // Add Polyfill
  Tasks.add({
    'title': 'Add Polyfill',
    'task': () => fs.writeFileSync(out, fs.readFileSync(PolyfillPath, 'utf8') + fs.readFileSync(out, 'utf8'))
  });

  // Run Everything
  await Tasks.run();
})();
