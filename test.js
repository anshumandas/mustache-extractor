const Mustache = require('mustache');
const Extractor = require('mustache-extractor');
const Helper = require('my-mustache-wax');
require('jest-similar');

function applyMustache(template, inputs){
  let partials = {};
  Helper.addFunctions(inputs);
  return Mustache.render(template, inputs, partials);
}

function extractMustache(template){
  let partials = {};
  return Extractor.process(template, partials, {}, [], [], true);
}

describe('test mustache gen and the template extraction for function', () => {
  let template = "Hello {{#__upperFirst}}{{name}}{{/__upperFirst}}";
  it('mustache gen', () => {
    expect(applyMustache(template, {'name': 'world'})).toEqual("Hello World");
  });
  it('extraction', () => {
    expect(extractMustache(template)).toBeSimilar({'name': 'value', '__upperFirst':'function'});
  });
});

describe('test mustache gen and the template extraction for array', () => {
  let template = "Hello {{#__removeTrailingComma}}{{#name}}{{.}}, {{/name}}{{/__removeTrailingComma}}";
  it('mustache gen', () => {
    expect(applyMustache(template, {'name': ['John', 'Doe']})).toEqual("Hello John, Doe");
  });
  it('extraction', () => {
    expect(extractMustache(template)).toBeSimilar({'name': {}, '__removeTrailingComma':'function'});
  });
});

describe('test mustache gen and the template extraction for array with dot notation', () => {
  let template = "Hello {{#__removeTrailingComma}}{{#name.0}}{{#name}}{{.}}, {{/name}}{{/name.0}}{{/__removeTrailingComma}}";
  it('mustache gen', () => {
    expect(applyMustache(template, {'name': ['John', 'Doe']})).toEqual("Hello John, Doe");
  });
  it('extraction', () => {
    expect(extractMustache(template)).toBeSimilar({'name': ['value'], '__removeTrailingComma':'function'});
  });
});

describe('test mustache gen and the template extraction for dot notation value', () => {
  let template = "Hello {{#__upperFirst}}{{name.hello}}{{/__upperFirst}}";
  it('mustache gen', () => {
    expect(applyMustache(template, {'name': {'hello':'world'}})).toEqual("Hello World");
  });
  it('extraction', () => {
    expect(extractMustache(template)).toBeSimilar({'name': {'hello': 'value'}, '__upperFirst':'function'});
  });
});

describe('test mustache gen and the template extraction for nested', () => {
  let template = "Hello {{^hidden}}{{#__upperFirst}}{{name.hello}}{{/__upperFirst}}{{/hidden}}";
  it('mustache gen', () => {
    expect(applyMustache(template, {'name': {'hello':'world'}, 'hidden': false})).toEqual("Hello World");
  });
  it('extraction', () => {
    expect(extractMustache(template)).toBeSimilar({'hidden': {}, 'name': {'hello': 'value'}, '__upperFirst':'function'});
  });
});

describe('test mustache gen and the template extraction for nested with heuristic', () => {
  let template = "Hello {{^hidden?}}{{#__upperFirst}}{{name.hello}}{{/__upperFirst}}{{/hidden?}}";
  it('mustache gen', () => {
    expect(applyMustache(template, {'name': {'hello':'world'}, 'hidden?': false})).toEqual("Hello World");
  });
  it('extraction', () => {
    expect(extractMustache(template)).toBeSimilar({'name': {'hello': 'value'}, '__upperFirst':'function', 'hidden?': 'boolean'});
  });
});

describe('test mustache gen and the template extraction for arrays with dot notation as check', () => {
  let template = "{{#__removeTrailingComma}}{{#array.0}}{{#array}}{{name}}, {{/array}}{{/array.0}}{{/__removeTrailingComma}}";
  it('mustache gen', () => {
    expect(applyMustache(template, {'array':[{'name': 'hello'}, {'name': 'world'}]})).toEqual("hello, world");
  });
  it('extraction', () => {
    expect(extractMustache(template)).toBeSimilar({'array': [{'name': 'value'}], '__removeTrailingComma':'function'});
  });
});

describe('test mustache gen and the template extraction for arrays with dot notation not as check', () => {
  let template = "{{#__removeTrailingComma}}{{#array.0}}{{name}}, {{/array.0}}{{/__removeTrailingComma}}";
  it('mustache gen', () => {
    expect(applyMustache(template, {'array':[{'name': 'hello'}, {'name': 'world'}]})).toEqual("hello");
  });
  it('extraction', () => {
    expect(extractMustache(template)).toBeSimilar({'array': [{'name': 'value'}], '__removeTrailingComma':'function'});
  });
});
