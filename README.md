# mustache-extractor
Utility for those who use Mustache templating engine with very complex templates set

# Problem

(Mustache)[https://mustache.github.io/] is an excellent templating and code generation utility.
There are times however that you need to understand the templates better for the input used and the input model is also not completely available.

Only in such times, should we need to extract our mustache using this tool...

# Solution
This is a simple helper utility for Mustache in NodeJs which:
- Parses all .mustache files in a specified folder and its sub-folders
- Creates a map of partials used
- For each template, which is not a partial, creates an YAML file to outline the input model schema


See the test.js file for usages

# Install

With npm:
```sh
npm install mustache-extractor --save-dev
```

# Heuristics
In the input model provided to Mustache we use the following heuristics to make to template cleaner:
- Keep parent and children tag names different. While using the helper functions use the name argument for the tags being created.
```
parent = {name: "A", children: [{name:"B"}]}
should instead be
parent = {parent_name: "A", children: [{child_name:"B"}]}
```
- use has_ prefix to check for nullability may not be needed if above is followed as then we do not need to care about parent and child scopes
- use is_ as prefix for booleans to distinguish between nullability check and boolean checks. 
- __ prefix used to define function names

These can then be used to extract the model in a better manner as well
