'use strict';

const _ = require('lodash');
const Fs = require('fs-extra');
const Yaml = require('js-yaml');
const Path = require('path');
const Chalk = require('chalk');

const MustacheExt = '.mustache';
const PrintDescription = false;
const Desc = "__description__";

function processFolder(input, output) {
  //TODO use the regex to get the template tag structure
  let map = findMustache(Path.resolve(input));
  let partials = removePartials(map);
  let merged = {};
  for (var path in map) {
    let model = parse(map[path], partials, {}, [], [], myHeuristics);
    _.merge(merged, model);
    let outFolder = output || Path.dirname(path);
    let outFile = Path.basename(path) + ".spec.yaml";
    writeAndLog(outFolder, outFile, model);
  }
  let outFolder = output || '.';
  let outFile = "mergedFile.spec.yaml";
  writeAndLog(outFolder, outFile, merged);
}

function safeYaml(model) {
  let yml = Yaml.safeDump(model, { indent: 2, lineWidth: -1, noRefs: true, skipInvalid: true });
  //convert __comment: to #comment
  return yml;//.replace(/__comment:/g, "# ");
}

function writeAndLog(filepath, filename, contents) {
  //split file path and mkdirs if not existing
  Fs.mkdirpSync(filepath, { recursive: true }, (err) => {
    if (err) throw err;
  });

  var fpath = Path.join(filepath, filename);
  Fs.writeFileSync(fpath, safeYaml(contents));
}

function findMustache(rootPath) {
  let map = {}; //key is the path, val is the content
  if(Fs.statSync(rootPath).isFile()) {
    processFile(rootPath, map);
  } if(Fs.statSync(rootPath).isDirectory()) {
    Fs
     .readdirSync(rootPath)
     .forEach((file) => {
       let path = Path.join(rootPath, file);
       processFile(path, map);
     });
  }
  return map;
}

function processFile(path, map) {
  if(Fs.statSync(path).isFile()) {
    if(path.endsWith(MustacheExt)) {
      map[path] = Fs.readFileSync(path, 'utf8');
    }
  } else {
    _.merge(map, findMustache(path));
  }
}

function removePartials(map, partialPathMap) {
  partialPathMap = partialPathMap || {}; //key is id and val is path
  let partialsMap = {}; //key is the partial id, val is the content
  let mains = {}; //key is the path, val is the content of those that ae not in partials
  //remove the partials from map
  let partials = [];
  for (var content of _.values(map)) {
    partials = _.union(partials, parseContentForPartials(content));
  }
  let knownPaths = _.values(partialPathMap);
  for (var partial of partials) {
    if (!partialPathMap.hasOwnProperty(partial)) {
      partialPathMap[partial] = null;
    }
  }
  for (var path of _.keys(map)) {
    if(knownPaths.includes(path)) {
      partialsMap[path] = map[path];
      delete map[path];
    } else {
      for (var p of partials) {
        let fname = Path.basename(path, MustacheExt);
        if(fname.includes(p)) {
          partialsMap[p] = map[path];
          delete map[path];
        }
      }
    }
  }
  return partialsMap;
}

function parseContentForPartials(content) {
  let partials = [];
  let regex = /[{]{2}[>]([^}]*)[}]{2}/gm;
  let m;
  while ((m = regex.exec(content)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
          regex.lastIndex++;
      }

      // The result can be accessed through the `m`-variable.
      m.forEach((match, groupIndex) => {
        if(groupIndex == 1) {
          partials.push(match);
        }
      });
  }
  return partials;
}

function getAction(symbol) {
  let action = null;
  switch (symbol) {
    case '>':
      action = "partial";
      break;
    case '#':
      action = "positive";
      break;
    case '^':
      action = "negative";
      break;
    case '/':
      action = "pop";
      break;
    case '!':
      action = "comment";
      break;
    default:
      action = "print";
    }
  return action;
}

function parse(content, partials, current, pointerStack, nameStack, heuristics) {
  if(heuristics == true) heuristics = myHeuristics;

  let regex = /([{]{2}([#\/>&!^]?)((?![{])([^}]*))[}]{2}(?![}]))|([{]{3}([^}]*)[}]{3})/gm;
  let m;
  while ((m = regex.exec(content)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
          regex.lastIndex++;
      }

      // The result can be accessed through the `m`-variable.
      let action = null;
      m.forEach((match, groupIndex) => {
        if(groupIndex == 2) {
          action = getAction(match);
        }
        if(match && (groupIndex == 3 || groupIndex == 6)) {
          match = match.trim(); //this is according to Mustache spec # Whitespace Insensitivity https://github.com/mustache/spec/blob/master/specs/delimiters.yml
          let vars = (match == '.') ? ['.'] : match.split('.');
          if(action == "pop") {
            for (var i = vars.length - 1; i >= 0; i--) {
              current = makeTree(action, groupIndex, vars[i], partials, current, pointerStack, nameStack, heuristics);
            }
          } else if(action == "positive" || action == "negative") {
            for (var i = 0; i < vars.length; i++) {
              current = makeTree(action, groupIndex, vars[i], partials, current, pointerStack, nameStack, heuristics);
            }
          } else if(action == "print" && match != '.') {
            for (var i = 0; i < vars.length - 1; i++) {
              current = makeTree("positive", groupIndex, vars[i], partials, current, pointerStack, nameStack, heuristics);
            }
            current = makeTree(action, groupIndex, vars[vars.length - 1], partials, current, pointerStack, nameStack, heuristics);
            for (var i = vars.length - 2; i >= 0; i--) {
              current = makeTree("pop", groupIndex, vars[i], partials, current, pointerStack, nameStack, heuristics);
            }
          } else {
            current = makeTree(action, groupIndex, match, partials, current, pointerStack, nameStack, heuristics);
          }
        }
      });
  }
  return current;
}

function makeTree(action, groupIndex, match, partials, current, pointerStack, nameStack, heuristics) {
  if(groupIndex == 3 && match) {
    //record the tag
    if(action == "partial") {
      let old = nameStack.length;
      current = parse(partials[match], partials, current, pointerStack, nameStack, heuristics);
      if(nameStack.length != old) {
        throw new Error;
      }
    } else if(action == "positive") {
      if(!heuristics(action, match, current, pointerStack, nameStack)) {
        if(nameStack && nameStack.length > 0 && match == nameStack[nameStack.length - 1]) {
          pointerStack.push(pointerStack[pointerStack.length - 1]);
          nameStack.push(match);
        } else if(!current) {
          throw new Error;
        } else {
          while(_.isArray(current)) {
            if(current.length == 0) current[0] = {};
            current = current[0];
          }
          if(!current[match]) {
            if(!isNaN(match)) {
              let parent = pointerStack[pointerStack.length - 1];
              if(nameStack && nameStack.length > 0 && parent) {
                let o = parent[nameStack[nameStack.length - 1]];
                parent[nameStack[nameStack.length - 1]] = [];
                let p = parent[nameStack[nameStack.length - 1]];
                if(o) p.push(o);
                current = p;
              }
            } else if(_.isPlainObject(current)){
              current[match] = {}
              if(PrintDescription) current[match][Desc] = "boolean or null check or an object that contains below props. Properties can also be of parent scope";
              pointerStack.push(current);
              nameStack.push(match);
              current = current[match];
            } else {
              // throw new Error;
            }
          } else if(_.isArray(current[match])) {
            if(!current[match][0]) {
              current[match][0] = {}
              if(PrintDescription) current[match][0][Desc] = "array item";
            }
            pointerStack.push(current);
            nameStack.push(match);
            current = current[match][0];
          } else {
            pointerStack.push(current);
            nameStack.push(match);
            current = current[match];
          }
        }
      }
    } else if(action == "negative") {
      if(!heuristics(action, match, current, pointerStack, nameStack)) {
        if(nameStack && nameStack.length > 0 && match == nameStack[nameStack.length - 1]) {
          pointerStack.push(pointerStack[pointerStack.length - 1]);
          nameStack.push(match);
        } else if(!current) {
          throw new Error;
        } else {
          if(_.isPlainObject(current) && !current[match]) {
            if(!isNaN(match)) {
              let parent = pointerStack[pointerStack.length - 1];
              if(nameStack && nameStack.length > 0 && parent) {
                let o = parent[nameStack[nameStack.length - 1]];
                parent[nameStack[nameStack.length - 1]] = [];
                let p = parent[nameStack[nameStack.length - 1]];
                if(o) p.push(o);
              }
            } else {
              current[match] = {}
              if(PrintDescription) current[match][Desc] = "boolean or null check or an object that contains below props. Properties can also be of parent scope";
              pointerStack.push(current);
              nameStack.push(match);
            }
          } else if(_.isArray(current[match])) {
            if(!current[match][0]) {
              current[match][0] = {}
              if(PrintDescription) current[match][0][Desc] = "array item";
            }
            pointerStack.push(current);
            nameStack.push(match);
          } else {
            pointerStack.push(current);
            nameStack.push(match);
          }
        }
      }
    } else if(action == "pop") {
      if(!heuristics(action, match, current, pointerStack, nameStack)) {
        if(isNaN(match) && pointerStack.length > 0 && match == nameStack[nameStack.length - 1]) {
          nameStack.pop();
          current = pointerStack.pop();
        }
      }
    } else if(action == "comment") {
      // console.log(`action ${action}, group ${groupIndex}: ${match}`);
    } else if(action == "print") {
      print(match, current, pointerStack, nameStack)
    }
  } else if(action == "print" && groupIndex == 6 && match) {
    print(match, current, pointerStack, nameStack);
  }
  return current;
}

function print(match, current, pointerStack, nameStack) {
  if(match == '.' || (nameStack && nameStack.length > 0 && match == nameStack[nameStack.length - 1])) {
    if(PrintDescription) current[Desc] = "probably be a value";
    else {
      let temp = current;
      try {
        temp = pointerStack[pointerStack.length - 1];
        let t = temp[nameStack[nameStack.length - 1]];
        if(!temp) {
          throw new Error;
        } else if(_.isArray(t)) {
          if(t.length > 0) t[0] = "value";
          else t.push("value");
        } else if(!t){
          temp[nameStack[nameStack.length - 1]] = "value";
        }
      } catch(e) {
        if(!temp) {
          throw new Error;
        } else if(_.isArray(temp)) {
          if(temp.length > 0) temp[0] = "value";
          else temp.push("value");
        }
      }
    }
  } else  {
    if(!current) {
      throw new Error;
    } else if(_.isArray(current)) {
      let t = current[0] || {};
      current = t;
    }
    if(!_.isPlainObject(current)) current = {};
    if(!current[match]) {
      current[match] = {};
    }
    if(PrintDescription) current[match][Desc] = "probably be a value";
    else current[match] = "value";
  }
}

exports.run = function run() {
  if(process.argv.length < 2) throw Error("Need folder path");
  let input = process.argv[1];
  let output = process.argv[2];
  processFolder(input, output);
}

exports.processFolder = processFolder;
exports.process = parse;

function myHeuristics(action, match, current, pointerStack, nameStack) {
  //Note: this only works with the pattern I have used. Remove this if you have not used the same
  //Heuristic 1:
  if(match.startsWith("__") && current) {
    if(!current[match] && action == "positive") {
      let node = {};
      //comment below if you do not want to add functions
      if(PrintDescription) {
        node[Desc] = "Global function";
      } else {
        node = "function";
      }
      let c = pointerStack.length > 0 ? pointerStack[0] : current;
      c[match] = node;
    }
    return true;
  }
  //Heuristic 2:
  if(match.endsWith("?") && current) {
    if(!current[match] && (action == "positive" || action == "negative")) {
      current[match] = {};
      if(PrintDescription) {
        current[match][Desc] = "A boolean check";
      } else {
        current[match] = "boolean";
      }
    }
    return true;
  }
  return false;
}
