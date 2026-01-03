'use strict';

var Dinero = require('dinero.js');

var validator$2 = {};

var util$3 = {};

(function (exports) {

	const nameStartChar = ':A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD';
	const nameChar = nameStartChar + '\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040';
	const nameRegexp = '[' + nameStartChar + '][' + nameChar + ']*';
	const regexName = new RegExp('^' + nameRegexp + '$');

	const getAllMatches = function(string, regex) {
	  const matches = [];
	  let match = regex.exec(string);
	  while (match) {
	    const allmatches = [];
	    allmatches.startIndex = regex.lastIndex - match[0].length;
	    const len = match.length;
	    for (let index = 0; index < len; index++) {
	      allmatches.push(match[index]);
	    }
	    matches.push(allmatches);
	    match = regex.exec(string);
	  }
	  return matches;
	};

	const isName = function(string) {
	  const match = regexName.exec(string);
	  return !(match === null || typeof match === 'undefined');
	};

	exports.isExist = function(v) {
	  return typeof v !== 'undefined';
	};

	exports.isEmptyObject = function(obj) {
	  return Object.keys(obj).length === 0;
	};

	/**
	 * Copy all the properties of a into b.
	 * @param {*} target
	 * @param {*} a
	 */
	exports.merge = function(target, a, arrayMode) {
	  if (a) {
	    const keys = Object.keys(a); // will return an array of own properties
	    const len = keys.length; //don't make it inline
	    for (let i = 0; i < len; i++) {
	      if (arrayMode === 'strict') {
	        target[keys[i]] = [ a[keys[i]] ];
	      } else {
	        target[keys[i]] = a[keys[i]];
	      }
	    }
	  }
	};
	/* exports.merge =function (b,a){
	  return Object.assign(b,a);
	} */

	exports.getValue = function(v) {
	  if (exports.isExist(v)) {
	    return v;
	  } else {
	    return '';
	  }
	};

	// const fakeCall = function(a) {return a;};
	// const fakeCallNoReturn = function() {};

	exports.isName = isName;
	exports.getAllMatches = getAllMatches;
	exports.nameRegexp = nameRegexp; 
} (util$3));

const util$2 = util$3;

const defaultOptions$2 = {
  allowBooleanAttributes: false, //A tag can have attributes without any value
  unpairedTags: []
};

//const tagsPattern = new RegExp("<\\/?([\\w:\\-_\.]+)\\s*\/?>","g");
validator$2.validate = function (xmlData, options) {
  options = Object.assign({}, defaultOptions$2, options);

  //xmlData = xmlData.replace(/(\r\n|\n|\r)/gm,"");//make it single line
  //xmlData = xmlData.replace(/(^\s*<\?xml.*?\?>)/g,"");//Remove XML starting tag
  //xmlData = xmlData.replace(/(<!DOCTYPE[\s\w\"\.\/\-\:]+(\[.*\])*\s*>)/g,"");//Remove DOCTYPE
  const tags = [];
  let tagFound = false;

  //indicates that the root tag has been closed (aka. depth 0 has been reached)
  let reachedRoot = false;

  if (xmlData[0] === '\ufeff') {
    // check for byte order mark (BOM)
    xmlData = xmlData.substr(1);
  }
  
  for (let i = 0; i < xmlData.length; i++) {

    if (xmlData[i] === '<' && xmlData[i+1] === '?') {
      i+=2;
      i = readPI(xmlData,i);
      if (i.err) return i;
    }else if (xmlData[i] === '<') {
      //starting of tag
      //read until you reach to '>' avoiding any '>' in attribute value
      let tagStartPos = i;
      i++;
      
      if (xmlData[i] === '!') {
        i = readCommentAndCDATA(xmlData, i);
        continue;
      } else {
        let closingTag = false;
        if (xmlData[i] === '/') {
          //closing tag
          closingTag = true;
          i++;
        }
        //read tagname
        let tagName = '';
        for (; i < xmlData.length &&
          xmlData[i] !== '>' &&
          xmlData[i] !== ' ' &&
          xmlData[i] !== '\t' &&
          xmlData[i] !== '\n' &&
          xmlData[i] !== '\r'; i++
        ) {
          tagName += xmlData[i];
        }
        tagName = tagName.trim();
        //console.log(tagName);

        if (tagName[tagName.length - 1] === '/') {
          //self closing tag without attributes
          tagName = tagName.substring(0, tagName.length - 1);
          //continue;
          i--;
        }
        if (!validateTagName(tagName)) {
          let msg;
          if (tagName.trim().length === 0) {
            msg = "Invalid space after '<'.";
          } else {
            msg = "Tag '"+tagName+"' is an invalid name.";
          }
          return getErrorObject('InvalidTag', msg, getLineNumberForPosition(xmlData, i));
        }

        const result = readAttributeStr(xmlData, i);
        if (result === false) {
          return getErrorObject('InvalidAttr', "Attributes for '"+tagName+"' have open quote.", getLineNumberForPosition(xmlData, i));
        }
        let attrStr = result.value;
        i = result.index;

        if (attrStr[attrStr.length - 1] === '/') {
          //self closing tag
          const attrStrStart = i - attrStr.length;
          attrStr = attrStr.substring(0, attrStr.length - 1);
          const isValid = validateAttributeString(attrStr, options);
          if (isValid === true) {
            tagFound = true;
            //continue; //text may presents after self closing tag
          } else {
            //the result from the nested function returns the position of the error within the attribute
            //in order to get the 'true' error line, we need to calculate the position where the attribute begins (i - attrStr.length) and then add the position within the attribute
            //this gives us the absolute index in the entire xml, which we can use to find the line at last
            return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, attrStrStart + isValid.err.line));
          }
        } else if (closingTag) {
          if (!result.tagClosed) {
            return getErrorObject('InvalidTag', "Closing tag '"+tagName+"' doesn't have proper closing.", getLineNumberForPosition(xmlData, i));
          } else if (attrStr.trim().length > 0) {
            return getErrorObject('InvalidTag', "Closing tag '"+tagName+"' can't have attributes or invalid starting.", getLineNumberForPosition(xmlData, tagStartPos));
          } else if (tags.length === 0) {
            return getErrorObject('InvalidTag', "Closing tag '"+tagName+"' has not been opened.", getLineNumberForPosition(xmlData, tagStartPos));
          } else {
            const otg = tags.pop();
            if (tagName !== otg.tagName) {
              let openPos = getLineNumberForPosition(xmlData, otg.tagStartPos);
              return getErrorObject('InvalidTag',
                "Expected closing tag '"+otg.tagName+"' (opened in line "+openPos.line+", col "+openPos.col+") instead of closing tag '"+tagName+"'.",
                getLineNumberForPosition(xmlData, tagStartPos));
            }

            //when there are no more tags, we reached the root level.
            if (tags.length == 0) {
              reachedRoot = true;
            }
          }
        } else {
          const isValid = validateAttributeString(attrStr, options);
          if (isValid !== true) {
            //the result from the nested function returns the position of the error within the attribute
            //in order to get the 'true' error line, we need to calculate the position where the attribute begins (i - attrStr.length) and then add the position within the attribute
            //this gives us the absolute index in the entire xml, which we can use to find the line at last
            return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, i - attrStr.length + isValid.err.line));
          }

          //if the root level has been reached before ...
          if (reachedRoot === true) {
            return getErrorObject('InvalidXml', 'Multiple possible root nodes found.', getLineNumberForPosition(xmlData, i));
          } else if(options.unpairedTags.indexOf(tagName) !== -1); else {
            tags.push({tagName, tagStartPos});
          }
          tagFound = true;
        }

        //skip tag text value
        //It may include comments and CDATA value
        for (i++; i < xmlData.length; i++) {
          if (xmlData[i] === '<') {
            if (xmlData[i + 1] === '!') {
              //comment or CADATA
              i++;
              i = readCommentAndCDATA(xmlData, i);
              continue;
            } else if (xmlData[i+1] === '?') {
              i = readPI(xmlData, ++i);
              if (i.err) return i;
            } else {
              break;
            }
          } else if (xmlData[i] === '&') {
            const afterAmp = validateAmpersand(xmlData, i);
            if (afterAmp == -1)
              return getErrorObject('InvalidChar', "char '&' is not expected.", getLineNumberForPosition(xmlData, i));
            i = afterAmp;
          }else {
            if (reachedRoot === true && !isWhiteSpace(xmlData[i])) {
              return getErrorObject('InvalidXml', "Extra text at the end", getLineNumberForPosition(xmlData, i));
            }
          }
        } //end of reading tag text value
        if (xmlData[i] === '<') {
          i--;
        }
      }
    } else {
      if ( isWhiteSpace(xmlData[i])) {
        continue;
      }
      return getErrorObject('InvalidChar', "char '"+xmlData[i]+"' is not expected.", getLineNumberForPosition(xmlData, i));
    }
  }

  if (!tagFound) {
    return getErrorObject('InvalidXml', 'Start tag expected.', 1);
  }else if (tags.length == 1) {
      return getErrorObject('InvalidTag', "Unclosed tag '"+tags[0].tagName+"'.", getLineNumberForPosition(xmlData, tags[0].tagStartPos));
  }else if (tags.length > 0) {
      return getErrorObject('InvalidXml', "Invalid '"+
          JSON.stringify(tags.map(t => t.tagName), null, 4).replace(/\r?\n/g, '')+
          "' found.", {line: 1, col: 1});
  }

  return true;
};

function isWhiteSpace(char){
  return char === ' ' || char === '\t' || char === '\n'  || char === '\r';
}
/**
 * Read Processing insstructions and skip
 * @param {*} xmlData
 * @param {*} i
 */
function readPI(xmlData, i) {
  const start = i;
  for (; i < xmlData.length; i++) {
    if (xmlData[i] == '?' || xmlData[i] == ' ') {
      //tagname
      const tagname = xmlData.substr(start, i - start);
      if (i > 5 && tagname === 'xml') {
        return getErrorObject('InvalidXml', 'XML declaration allowed only at the start of the document.', getLineNumberForPosition(xmlData, i));
      } else if (xmlData[i] == '?' && xmlData[i + 1] == '>') {
        //check if valid attribut string
        i++;
        break;
      } else {
        continue;
      }
    }
  }
  return i;
}

function readCommentAndCDATA(xmlData, i) {
  if (xmlData.length > i + 5 && xmlData[i + 1] === '-' && xmlData[i + 2] === '-') {
    //comment
    for (i += 3; i < xmlData.length; i++) {
      if (xmlData[i] === '-' && xmlData[i + 1] === '-' && xmlData[i + 2] === '>') {
        i += 2;
        break;
      }
    }
  } else if (
    xmlData.length > i + 8 &&
    xmlData[i + 1] === 'D' &&
    xmlData[i + 2] === 'O' &&
    xmlData[i + 3] === 'C' &&
    xmlData[i + 4] === 'T' &&
    xmlData[i + 5] === 'Y' &&
    xmlData[i + 6] === 'P' &&
    xmlData[i + 7] === 'E'
  ) {
    let angleBracketsCount = 1;
    for (i += 8; i < xmlData.length; i++) {
      if (xmlData[i] === '<') {
        angleBracketsCount++;
      } else if (xmlData[i] === '>') {
        angleBracketsCount--;
        if (angleBracketsCount === 0) {
          break;
        }
      }
    }
  } else if (
    xmlData.length > i + 9 &&
    xmlData[i + 1] === '[' &&
    xmlData[i + 2] === 'C' &&
    xmlData[i + 3] === 'D' &&
    xmlData[i + 4] === 'A' &&
    xmlData[i + 5] === 'T' &&
    xmlData[i + 6] === 'A' &&
    xmlData[i + 7] === '['
  ) {
    for (i += 8; i < xmlData.length; i++) {
      if (xmlData[i] === ']' && xmlData[i + 1] === ']' && xmlData[i + 2] === '>') {
        i += 2;
        break;
      }
    }
  }

  return i;
}

const doubleQuote = '"';
const singleQuote = "'";

/**
 * Keep reading xmlData until '<' is found outside the attribute value.
 * @param {string} xmlData
 * @param {number} i
 */
function readAttributeStr(xmlData, i) {
  let attrStr = '';
  let startChar = '';
  let tagClosed = false;
  for (; i < xmlData.length; i++) {
    if (xmlData[i] === doubleQuote || xmlData[i] === singleQuote) {
      if (startChar === '') {
        startChar = xmlData[i];
      } else if (startChar !== xmlData[i]) ; else {
        startChar = '';
      }
    } else if (xmlData[i] === '>') {
      if (startChar === '') {
        tagClosed = true;
        break;
      }
    }
    attrStr += xmlData[i];
  }
  if (startChar !== '') {
    return false;
  }

  return {
    value: attrStr,
    index: i,
    tagClosed: tagClosed
  };
}

/**
 * Select all the attributes whether valid or invalid.
 */
const validAttrStrRegxp = new RegExp('(\\s*)([^\\s=]+)(\\s*=)?(\\s*([\'"])(([\\s\\S])*?)\\5)?', 'g');

//attr, ="sd", a="amit's", a="sd"b="saf", ab  cd=""

function validateAttributeString(attrStr, options) {
  //console.log("start:"+attrStr+":end");

  //if(attrStr.trim().length === 0) return true; //empty string

  const matches = util$2.getAllMatches(attrStr, validAttrStrRegxp);
  const attrNames = {};

  for (let i = 0; i < matches.length; i++) {
    if (matches[i][1].length === 0) {
      //nospace before attribute name: a="sd"b="saf"
      return getErrorObject('InvalidAttr', "Attribute '"+matches[i][2]+"' has no space in starting.", getPositionFromMatch(matches[i]))
    } else if (matches[i][3] !== undefined && matches[i][4] === undefined) {
      return getErrorObject('InvalidAttr', "Attribute '"+matches[i][2]+"' is without value.", getPositionFromMatch(matches[i]));
    } else if (matches[i][3] === undefined && !options.allowBooleanAttributes) {
      //independent attribute: ab
      return getErrorObject('InvalidAttr', "boolean attribute '"+matches[i][2]+"' is not allowed.", getPositionFromMatch(matches[i]));
    }
    /* else if(matches[i][6] === undefined){//attribute without value: ab=
                    return { err: { code:"InvalidAttr",msg:"attribute " + matches[i][2] + " has no value assigned."}};
                } */
    const attrName = matches[i][2];
    if (!validateAttrName(attrName)) {
      return getErrorObject('InvalidAttr', "Attribute '"+attrName+"' is an invalid name.", getPositionFromMatch(matches[i]));
    }
    if (!attrNames.hasOwnProperty(attrName)) {
      //check for duplicate attribute.
      attrNames[attrName] = 1;
    } else {
      return getErrorObject('InvalidAttr', "Attribute '"+attrName+"' is repeated.", getPositionFromMatch(matches[i]));
    }
  }

  return true;
}

function validateNumberAmpersand(xmlData, i) {
  let re = /\d/;
  if (xmlData[i] === 'x') {
    i++;
    re = /[\da-fA-F]/;
  }
  for (; i < xmlData.length; i++) {
    if (xmlData[i] === ';')
      return i;
    if (!xmlData[i].match(re))
      break;
  }
  return -1;
}

function validateAmpersand(xmlData, i) {
  // https://www.w3.org/TR/xml/#dt-charref
  i++;
  if (xmlData[i] === ';')
    return -1;
  if (xmlData[i] === '#') {
    i++;
    return validateNumberAmpersand(xmlData, i);
  }
  let count = 0;
  for (; i < xmlData.length; i++, count++) {
    if (xmlData[i].match(/\w/) && count < 20)
      continue;
    if (xmlData[i] === ';')
      break;
    return -1;
  }
  return i;
}

function getErrorObject(code, message, lineNumber) {
  return {
    err: {
      code: code,
      msg: message,
      line: lineNumber.line || lineNumber,
      col: lineNumber.col,
    },
  };
}

function validateAttrName(attrName) {
  return util$2.isName(attrName);
}

// const startsWithXML = /^xml/i;

function validateTagName(tagname) {
  return util$2.isName(tagname) /* && !tagname.match(startsWithXML) */;
}

//this function returns the line number for the character at the given index
function getLineNumberForPosition(xmlData, index) {
  const lines = xmlData.substring(0, index).split(/\r?\n/);
  return {
    line: lines.length,

    // column number is last line's length + 1, because column numbering starts at 1:
    col: lines[lines.length - 1].length + 1
  };
}

//this function returns the position of the first character of match within attrStr
function getPositionFromMatch(match) {
  return match.startIndex + match[1].length;
}

var OptionsBuilder = {};

const defaultOptions$1 = {
    preserveOrder: false,
    attributeNamePrefix: '@_',
    attributesGroupName: false,
    textNodeName: '#text',
    ignoreAttributes: true,
    removeNSPrefix: false, // remove NS from tag name or attribute name if true
    allowBooleanAttributes: false, //a tag can have attributes without any value
    //ignoreRootElement : false,
    parseTagValue: true,
    parseAttributeValue: false,
    trimValues: true, //Trim string values of tag and attributes
    cdataPropName: false,
    numberParseOptions: {
      hex: true,
      leadingZeros: true,
      eNotation: true
    },
    tagValueProcessor: function(tagName, val) {
      return val;
    },
    attributeValueProcessor: function(attrName, val) {
      return val;
    },
    stopNodes: [], //nested tags will not be parsed even for errors
    alwaysCreateTextNode: false,
    isArray: () => false,
    commentPropName: false,
    unpairedTags: [],
    processEntities: true,
    htmlEntities: false,
    ignoreDeclaration: false,
    ignorePiTags: false,
    transformTagName: false,
    transformAttributeName: false,
    updateTag: function(tagName, jPath, attrs){
      return tagName
    },
    // skipEmptyListItem: false
};
   
const buildOptions$1 = function(options) {
    return Object.assign({}, defaultOptions$1, options);
};

OptionsBuilder.buildOptions = buildOptions$1;
OptionsBuilder.defaultOptions = defaultOptions$1;

class XmlNode{
  constructor(tagname) {
    this.tagname = tagname;
    this.child = []; //nested tags, text, cdata, comments in order
    this[":@"] = {}; //attributes map
  }
  add(key,val){
    // this.child.push( {name : key, val: val, isCdata: isCdata });
    if(key === "__proto__") key = "#__proto__";
    this.child.push( {[key]: val });
  }
  addChild(node) {
    if(node.tagname === "__proto__") node.tagname = "#__proto__";
    if(node[":@"] && Object.keys(node[":@"]).length > 0){
      this.child.push( { [node.tagname]: node.child, [":@"]: node[":@"] });
    }else {
      this.child.push( { [node.tagname]: node.child });
    }
  };
}

var xmlNode$1 = XmlNode;

const util$1 = util$3;

//TODO: handle comments
function readDocType$1(xmlData, i){
    
    const entities = {};
    if( xmlData[i + 3] === 'O' &&
         xmlData[i + 4] === 'C' &&
         xmlData[i + 5] === 'T' &&
         xmlData[i + 6] === 'Y' &&
         xmlData[i + 7] === 'P' &&
         xmlData[i + 8] === 'E')
    {    
        i = i+9;
        let angleBracketsCount = 1;
        let hasBody = false, comment = false;
        let exp = "";
        for(;i<xmlData.length;i++){
            if (xmlData[i] === '<' && !comment) { //Determine the tag type
                if( hasBody && isEntity(xmlData, i)){
                    i += 7; 
                    [entityName, val,i] = readEntityExp(xmlData,i+1);
                    if(val.indexOf("&") === -1) //Parameter entities are not supported
                        entities[ validateEntityName(entityName) ] = {
                            regx : RegExp( `&${entityName};`,"g"),
                            val: val
                        };
                }
                else if( hasBody && isElement(xmlData, i))  i += 8;//Not supported
                else if( hasBody && isAttlist(xmlData, i))  i += 8;//Not supported
                else if( hasBody && isNotation(xmlData, i)) i += 9;//Not supported
                else if( isComment)                         comment = true;
                else                                        throw new Error("Invalid DOCTYPE");

                angleBracketsCount++;
                exp = "";
            } else if (xmlData[i] === '>') { //Read tag content
                if(comment){
                    if( xmlData[i - 1] === "-" && xmlData[i - 2] === "-"){
                        comment = false;
                        angleBracketsCount--;
                    }
                }else {
                    angleBracketsCount--;
                }
                if (angleBracketsCount === 0) {
                  break;
                }
            }else if( xmlData[i] === '['){
                hasBody = true;
            }else {
                exp += xmlData[i];
            }
        }
        if(angleBracketsCount !== 0){
            throw new Error(`Unclosed DOCTYPE`);
        }
    }else {
        throw new Error(`Invalid Tag instead of DOCTYPE`);
    }
    return {entities, i};
}

function readEntityExp(xmlData,i){
    //External entities are not supported
    //    <!ENTITY ext SYSTEM "http://normal-website.com" >

    //Parameter entities are not supported
    //    <!ENTITY entityname "&anotherElement;">

    //Internal entities are supported
    //    <!ENTITY entityname "replacement text">
    
    //read EntityName
    let entityName = "";
    for (; i < xmlData.length && (xmlData[i] !== "'" && xmlData[i] !== '"' ); i++) {
        // if(xmlData[i] === " ") continue;
        // else 
        entityName += xmlData[i];
    }
    entityName = entityName.trim();
    if(entityName.indexOf(" ") !== -1) throw new Error("External entites are not supported");

    //read Entity Value
    const startChar = xmlData[i++];
    let val = "";
    for (; i < xmlData.length && xmlData[i] !== startChar ; i++) {
        val += xmlData[i];
    }
    return [entityName, val, i];
}

function isComment(xmlData, i){
    if(xmlData[i+1] === '!' &&
    xmlData[i+2] === '-' &&
    xmlData[i+3] === '-') return true
    return false
}
function isEntity(xmlData, i){
    if(xmlData[i+1] === '!' &&
    xmlData[i+2] === 'E' &&
    xmlData[i+3] === 'N' &&
    xmlData[i+4] === 'T' &&
    xmlData[i+5] === 'I' &&
    xmlData[i+6] === 'T' &&
    xmlData[i+7] === 'Y') return true
    return false
}
function isElement(xmlData, i){
    if(xmlData[i+1] === '!' &&
    xmlData[i+2] === 'E' &&
    xmlData[i+3] === 'L' &&
    xmlData[i+4] === 'E' &&
    xmlData[i+5] === 'M' &&
    xmlData[i+6] === 'E' &&
    xmlData[i+7] === 'N' &&
    xmlData[i+8] === 'T') return true
    return false
}

function isAttlist(xmlData, i){
    if(xmlData[i+1] === '!' &&
    xmlData[i+2] === 'A' &&
    xmlData[i+3] === 'T' &&
    xmlData[i+4] === 'T' &&
    xmlData[i+5] === 'L' &&
    xmlData[i+6] === 'I' &&
    xmlData[i+7] === 'S' &&
    xmlData[i+8] === 'T') return true
    return false
}
function isNotation(xmlData, i){
    if(xmlData[i+1] === '!' &&
    xmlData[i+2] === 'N' &&
    xmlData[i+3] === 'O' &&
    xmlData[i+4] === 'T' &&
    xmlData[i+5] === 'A' &&
    xmlData[i+6] === 'T' &&
    xmlData[i+7] === 'I' &&
    xmlData[i+8] === 'O' &&
    xmlData[i+9] === 'N') return true
    return false
}

function validateEntityName(name){
    if (util$1.isName(name))
	return name;
    else
        throw new Error(`Invalid entity name ${name}`);
}

var DocTypeReader = readDocType$1;

const hexRegex = /^[-+]?0x[a-fA-F0-9]+$/;
const numRegex = /^([\-\+])?(0*)(\.[0-9]+([eE]\-?[0-9]+)?|[0-9]+(\.[0-9]+([eE]\-?[0-9]+)?)?)$/;
// const octRegex = /0x[a-z0-9]+/;
// const binRegex = /0x[a-z0-9]+/;


//polyfill
if (!Number.parseInt && window.parseInt) {
    Number.parseInt = window.parseInt;
}
if (!Number.parseFloat && window.parseFloat) {
    Number.parseFloat = window.parseFloat;
}

  
const consider = {
    hex :  true,
    leadingZeros: true,
    decimalPoint: "\.",
    eNotation: true
    //skipLike: /regex/
};

function toNumber$1(str, options = {}){
    // const options = Object.assign({}, consider);
    // if(opt.leadingZeros === false){
    //     options.leadingZeros = false;
    // }else if(opt.hex === false){
    //     options.hex = false;
    // }

    options = Object.assign({}, consider, options );
    if(!str || typeof str !== "string" ) return str;
    
    let trimmedStr  = str.trim();
    // if(trimmedStr === "0.0") return 0;
    // else if(trimmedStr === "+0.0") return 0;
    // else if(trimmedStr === "-0.0") return -0;

    if(options.skipLike !== undefined && options.skipLike.test(trimmedStr)) return str;
    else if (options.hex && hexRegex.test(trimmedStr)) {
        return Number.parseInt(trimmedStr, 16);
    // } else if (options.parseOct && octRegex.test(str)) {
    //     return Number.parseInt(val, 8);
    // }else if (options.parseBin && binRegex.test(str)) {
    //     return Number.parseInt(val, 2);
    }else {
        //separate negative sign, leading zeros, and rest number
        const match = numRegex.exec(trimmedStr);
        if(match){
            const sign = match[1];
            const leadingZeros = match[2];
            let numTrimmedByZeros = trimZeros(match[3]); //complete num without leading zeros
            //trim ending zeros for floating number
            
            const eNotation = match[4] || match[6];
            if(!options.leadingZeros && leadingZeros.length > 0 && sign && trimmedStr[2] !== ".") return str; //-0123
            else if(!options.leadingZeros && leadingZeros.length > 0 && !sign && trimmedStr[1] !== ".") return str; //0123
            else {//no leading zeros or leading zeros are allowed
                const num = Number(trimmedStr);
                const numStr = "" + num;
                if(numStr.search(/[eE]/) !== -1){ //given number is long and parsed to eNotation
                    if(options.eNotation) return num;
                    else return str;
                }else if(eNotation){ //given number has enotation
                    if(options.eNotation) return num;
                    else return str;
                }else if(trimmedStr.indexOf(".") !== -1){ //floating number
                    // const decimalPart = match[5].substr(1);
                    // const intPart = trimmedStr.substr(0,trimmedStr.indexOf("."));

                    
                    // const p = numStr.indexOf(".");
                    // const givenIntPart = numStr.substr(0,p);
                    // const givenDecPart = numStr.substr(p+1);
                    if(numStr === "0" && (numTrimmedByZeros === "") ) return num; //0.0
                    else if(numStr === numTrimmedByZeros) return num; //0.456. 0.79000
                    else if( sign && numStr === "-"+numTrimmedByZeros) return num;
                    else return str;
                }
                
                if(leadingZeros){
                    // if(numTrimmedByZeros === numStr){
                    //     if(options.leadingZeros) return num;
                    //     else return str;
                    // }else return str;
                    if(numTrimmedByZeros === numStr) return num;
                    else if(sign+numTrimmedByZeros === numStr) return num;
                    else return str;
                }

                if(trimmedStr === numStr) return num;
                else if(trimmedStr === sign+numStr) return num;
                // else{
                //     //number with +/- sign
                //     trimmedStr.test(/[-+][0-9]);

                // }
                return str;
            }
            // else if(!eNotation && trimmedStr && trimmedStr !== Number(trimmedStr) ) return str;
            
        }else { //non-numeric string
            return str;
        }
    }
}

/**
 * 
 * @param {string} numStr without leading zeros
 * @returns 
 */
function trimZeros(numStr){
    if(numStr && numStr.indexOf(".") !== -1){//float
        numStr = numStr.replace(/0+$/, ""); //remove ending zeros
        if(numStr === ".")  numStr = "0";
        else if(numStr[0] === ".")  numStr = "0"+numStr;
        else if(numStr[numStr.length-1] === ".")  numStr = numStr.substr(0,numStr.length-1);
        return numStr;
    }
    return numStr;
}
var strnum = toNumber$1;

function getIgnoreAttributesFn$2(ignoreAttributes) {
    if (typeof ignoreAttributes === 'function') {
        return ignoreAttributes
    }
    if (Array.isArray(ignoreAttributes)) {
        return (attrName) => {
            for (const pattern of ignoreAttributes) {
                if (typeof pattern === 'string' && attrName === pattern) {
                    return true
                }
                if (pattern instanceof RegExp && pattern.test(attrName)) {
                    return true
                }
            }
        }
    }
    return () => false
}

var ignoreAttributes = getIgnoreAttributesFn$2;

///@ts-check

const util = util$3;
const xmlNode = xmlNode$1;
const readDocType = DocTypeReader;
const toNumber = strnum;
const getIgnoreAttributesFn$1 = ignoreAttributes;

// const regx =
//   '<((!\\[CDATA\\[([\\s\\S]*?)(]]>))|((NAME:)?(NAME))([^>]*)>|((\\/)(NAME)\\s*>))([^<]*)'
//   .replace(/NAME/g, util.nameRegexp);

//const tagsRegx = new RegExp("<(\\/?[\\w:\\-\._]+)([^>]*)>(\\s*"+cdataRegx+")*([^<]+)?","g");
//const tagsRegx = new RegExp("<(\\/?)((\\w*:)?([\\w:\\-\._]+))([^>]*)>([^<]*)("+cdataRegx+"([^<]*))*([^<]+)?","g");

let OrderedObjParser$1 = class OrderedObjParser{
  constructor(options){
    this.options = options;
    this.currentNode = null;
    this.tagsNodeStack = [];
    this.docTypeEntities = {};
    this.lastEntities = {
      "apos" : { regex: /&(apos|#39|#x27);/g, val : "'"},
      "gt" : { regex: /&(gt|#62|#x3E);/g, val : ">"},
      "lt" : { regex: /&(lt|#60|#x3C);/g, val : "<"},
      "quot" : { regex: /&(quot|#34|#x22);/g, val : "\""},
    };
    this.ampEntity = { regex: /&(amp|#38|#x26);/g, val : "&"};
    this.htmlEntities = {
      "space": { regex: /&(nbsp|#160);/g, val: " " },
      // "lt" : { regex: /&(lt|#60);/g, val: "<" },
      // "gt" : { regex: /&(gt|#62);/g, val: ">" },
      // "amp" : { regex: /&(amp|#38);/g, val: "&" },
      // "quot" : { regex: /&(quot|#34);/g, val: "\"" },
      // "apos" : { regex: /&(apos|#39);/g, val: "'" },
      "cent" : { regex: /&(cent|#162);/g, val: "¢" },
      "pound" : { regex: /&(pound|#163);/g, val: "£" },
      "yen" : { regex: /&(yen|#165);/g, val: "¥" },
      "euro" : { regex: /&(euro|#8364);/g, val: "€" },
      "copyright" : { regex: /&(copy|#169);/g, val: "©" },
      "reg" : { regex: /&(reg|#174);/g, val: "®" },
      "inr" : { regex: /&(inr|#8377);/g, val: "₹" },
      "num_dec": { regex: /&#([0-9]{1,7});/g, val : (_, str) => String.fromCharCode(Number.parseInt(str, 10)) },
      "num_hex": { regex: /&#x([0-9a-fA-F]{1,6});/g, val : (_, str) => String.fromCharCode(Number.parseInt(str, 16)) },
    };
    this.addExternalEntities = addExternalEntities;
    this.parseXml = parseXml;
    this.parseTextData = parseTextData;
    this.resolveNameSpace = resolveNameSpace;
    this.buildAttributesMap = buildAttributesMap;
    this.isItStopNode = isItStopNode;
    this.replaceEntitiesValue = replaceEntitiesValue$1;
    this.readStopNodeData = readStopNodeData;
    this.saveTextToParentTag = saveTextToParentTag;
    this.addChild = addChild;
    this.ignoreAttributesFn = getIgnoreAttributesFn$1(this.options.ignoreAttributes);
  }

};

function addExternalEntities(externalEntities){
  const entKeys = Object.keys(externalEntities);
  for (let i = 0; i < entKeys.length; i++) {
    const ent = entKeys[i];
    this.lastEntities[ent] = {
       regex: new RegExp("&"+ent+";","g"),
       val : externalEntities[ent]
    };
  }
}

/**
 * @param {string} val
 * @param {string} tagName
 * @param {string} jPath
 * @param {boolean} dontTrim
 * @param {boolean} hasAttributes
 * @param {boolean} isLeafNode
 * @param {boolean} escapeEntities
 */
function parseTextData(val, tagName, jPath, dontTrim, hasAttributes, isLeafNode, escapeEntities) {
  if (val !== undefined) {
    if (this.options.trimValues && !dontTrim) {
      val = val.trim();
    }
    if(val.length > 0){
      if(!escapeEntities) val = this.replaceEntitiesValue(val);
      
      const newval = this.options.tagValueProcessor(tagName, val, jPath, hasAttributes, isLeafNode);
      if(newval === null || newval === undefined){
        //don't parse
        return val;
      }else if(typeof newval !== typeof val || newval !== val){
        //overwrite
        return newval;
      }else if(this.options.trimValues){
        return parseValue(val, this.options.parseTagValue, this.options.numberParseOptions);
      }else {
        const trimmedVal = val.trim();
        if(trimmedVal === val){
          return parseValue(val, this.options.parseTagValue, this.options.numberParseOptions);
        }else {
          return val;
        }
      }
    }
  }
}

function resolveNameSpace(tagname) {
  if (this.options.removeNSPrefix) {
    const tags = tagname.split(':');
    const prefix = tagname.charAt(0) === '/' ? '/' : '';
    if (tags[0] === 'xmlns') {
      return '';
    }
    if (tags.length === 2) {
      tagname = prefix + tags[1];
    }
  }
  return tagname;
}

//TODO: change regex to capture NS
//const attrsRegx = new RegExp("([\\w\\-\\.\\:]+)\\s*=\\s*(['\"])((.|\n)*?)\\2","gm");
const attrsRegx = new RegExp('([^\\s=]+)\\s*(=\\s*([\'"])([\\s\\S]*?)\\3)?', 'gm');

function buildAttributesMap(attrStr, jPath, tagName) {
  if (this.options.ignoreAttributes !== true && typeof attrStr === 'string') {
    // attrStr = attrStr.replace(/\r?\n/g, ' ');
    //attrStr = attrStr || attrStr.trim();

    const matches = util.getAllMatches(attrStr, attrsRegx);
    const len = matches.length; //don't make it inline
    const attrs = {};
    for (let i = 0; i < len; i++) {
      const attrName = this.resolveNameSpace(matches[i][1]);
      if (this.ignoreAttributesFn(attrName, jPath)) {
        continue
      }
      let oldVal = matches[i][4];
      let aName = this.options.attributeNamePrefix + attrName;
      if (attrName.length) {
        if (this.options.transformAttributeName) {
          aName = this.options.transformAttributeName(aName);
        }
        if(aName === "__proto__") aName  = "#__proto__";
        if (oldVal !== undefined) {
          if (this.options.trimValues) {
            oldVal = oldVal.trim();
          }
          oldVal = this.replaceEntitiesValue(oldVal);
          const newVal = this.options.attributeValueProcessor(attrName, oldVal, jPath);
          if(newVal === null || newVal === undefined){
            //don't parse
            attrs[aName] = oldVal;
          }else if(typeof newVal !== typeof oldVal || newVal !== oldVal){
            //overwrite
            attrs[aName] = newVal;
          }else {
            //parse
            attrs[aName] = parseValue(
              oldVal,
              this.options.parseAttributeValue,
              this.options.numberParseOptions
            );
          }
        } else if (this.options.allowBooleanAttributes) {
          attrs[aName] = true;
        }
      }
    }
    if (!Object.keys(attrs).length) {
      return;
    }
    if (this.options.attributesGroupName) {
      const attrCollection = {};
      attrCollection[this.options.attributesGroupName] = attrs;
      return attrCollection;
    }
    return attrs
  }
}

const parseXml = function(xmlData) {
  xmlData = xmlData.replace(/\r\n?/g, "\n"); //TODO: remove this line
  const xmlObj = new xmlNode('!xml');
  let currentNode = xmlObj;
  let textData = "";
  let jPath = "";
  for(let i=0; i< xmlData.length; i++){//for each char in XML data
    const ch = xmlData[i];
    if(ch === '<'){
      // const nextIndex = i+1;
      // const _2ndChar = xmlData[nextIndex];
      if( xmlData[i+1] === '/') {//Closing Tag
        const closeIndex = findClosingIndex(xmlData, ">", i, "Closing Tag is not closed.");
        let tagName = xmlData.substring(i+2,closeIndex).trim();

        if(this.options.removeNSPrefix){
          const colonIndex = tagName.indexOf(":");
          if(colonIndex !== -1){
            tagName = tagName.substr(colonIndex+1);
          }
        }

        if(this.options.transformTagName) {
          tagName = this.options.transformTagName(tagName);
        }

        if(currentNode){
          textData = this.saveTextToParentTag(textData, currentNode, jPath);
        }

        //check if last tag of nested tag was unpaired tag
        const lastTagName = jPath.substring(jPath.lastIndexOf(".")+1);
        if(tagName && this.options.unpairedTags.indexOf(tagName) !== -1 ){
          throw new Error(`Unpaired tag can not be used as closing tag: </${tagName}>`);
        }
        let propIndex = 0;
        if(lastTagName && this.options.unpairedTags.indexOf(lastTagName) !== -1 ){
          propIndex = jPath.lastIndexOf('.', jPath.lastIndexOf('.')-1);
          this.tagsNodeStack.pop();
        }else {
          propIndex = jPath.lastIndexOf(".");
        }
        jPath = jPath.substring(0, propIndex);

        currentNode = this.tagsNodeStack.pop();//avoid recursion, set the parent tag scope
        textData = "";
        i = closeIndex;
      } else if( xmlData[i+1] === '?') {

        let tagData = readTagExp(xmlData,i, false, "?>");
        if(!tagData) throw new Error("Pi Tag is not closed.");

        textData = this.saveTextToParentTag(textData, currentNode, jPath);
        if( (this.options.ignoreDeclaration && tagData.tagName === "?xml") || this.options.ignorePiTags);else {
  
          const childNode = new xmlNode(tagData.tagName);
          childNode.add(this.options.textNodeName, "");
          
          if(tagData.tagName !== tagData.tagExp && tagData.attrExpPresent){
            childNode[":@"] = this.buildAttributesMap(tagData.tagExp, jPath, tagData.tagName);
          }
          this.addChild(currentNode, childNode, jPath);

        }


        i = tagData.closeIndex + 1;
      } else if(xmlData.substr(i + 1, 3) === '!--') {
        const endIndex = findClosingIndex(xmlData, "-->", i+4, "Comment is not closed.");
        if(this.options.commentPropName){
          const comment = xmlData.substring(i + 4, endIndex - 2);

          textData = this.saveTextToParentTag(textData, currentNode, jPath);

          currentNode.add(this.options.commentPropName, [ { [this.options.textNodeName] : comment } ]);
        }
        i = endIndex;
      } else if( xmlData.substr(i + 1, 2) === '!D') {
        const result = readDocType(xmlData, i);
        this.docTypeEntities = result.entities;
        i = result.i;
      }else if(xmlData.substr(i + 1, 2) === '![') {
        const closeIndex = findClosingIndex(xmlData, "]]>", i, "CDATA is not closed.") - 2;
        const tagExp = xmlData.substring(i + 9,closeIndex);

        textData = this.saveTextToParentTag(textData, currentNode, jPath);

        let val = this.parseTextData(tagExp, currentNode.tagname, jPath, true, false, true, true);
        if(val == undefined) val = "";

        //cdata should be set even if it is 0 length string
        if(this.options.cdataPropName){
          currentNode.add(this.options.cdataPropName, [ { [this.options.textNodeName] : tagExp } ]);
        }else {
          currentNode.add(this.options.textNodeName, val);
        }
        
        i = closeIndex + 2;
      }else {//Opening tag
        let result = readTagExp(xmlData,i, this.options.removeNSPrefix);
        let tagName= result.tagName;
        const rawTagName = result.rawTagName;
        let tagExp = result.tagExp;
        let attrExpPresent = result.attrExpPresent;
        let closeIndex = result.closeIndex;

        if (this.options.transformTagName) {
          tagName = this.options.transformTagName(tagName);
        }
        
        //save text as child node
        if (currentNode && textData) {
          if(currentNode.tagname !== '!xml'){
            //when nested tag is found
            textData = this.saveTextToParentTag(textData, currentNode, jPath, false);
          }
        }

        //check if last tag was unpaired tag
        const lastTag = currentNode;
        if(lastTag && this.options.unpairedTags.indexOf(lastTag.tagname) !== -1 ){
          currentNode = this.tagsNodeStack.pop();
          jPath = jPath.substring(0, jPath.lastIndexOf("."));
        }
        if(tagName !== xmlObj.tagname){
          jPath += jPath ? "." + tagName : tagName;
        }
        if (this.isItStopNode(this.options.stopNodes, jPath, tagName)) {
          let tagContent = "";
          //self-closing tag
          if(tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1){
            if(tagName[tagName.length - 1] === "/"){ //remove trailing '/'
              tagName = tagName.substr(0, tagName.length - 1);
              jPath = jPath.substr(0, jPath.length - 1);
              tagExp = tagName;
            }else {
              tagExp = tagExp.substr(0, tagExp.length - 1);
            }
            i = result.closeIndex;
          }
          //unpaired tag
          else if(this.options.unpairedTags.indexOf(tagName) !== -1){
            
            i = result.closeIndex;
          }
          //normal tag
          else {
            //read until closing tag is found
            const result = this.readStopNodeData(xmlData, rawTagName, closeIndex + 1);
            if(!result) throw new Error(`Unexpected end of ${rawTagName}`);
            i = result.i;
            tagContent = result.tagContent;
          }

          const childNode = new xmlNode(tagName);
          if(tagName !== tagExp && attrExpPresent){
            childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
          }
          if(tagContent) {
            tagContent = this.parseTextData(tagContent, tagName, jPath, true, attrExpPresent, true, true);
          }
          
          jPath = jPath.substr(0, jPath.lastIndexOf("."));
          childNode.add(this.options.textNodeName, tagContent);
          
          this.addChild(currentNode, childNode, jPath);
        }else {
  //selfClosing tag
          if(tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1){
            if(tagName[tagName.length - 1] === "/"){ //remove trailing '/'
              tagName = tagName.substr(0, tagName.length - 1);
              jPath = jPath.substr(0, jPath.length - 1);
              tagExp = tagName;
            }else {
              tagExp = tagExp.substr(0, tagExp.length - 1);
            }
            
            if(this.options.transformTagName) {
              tagName = this.options.transformTagName(tagName);
            }

            const childNode = new xmlNode(tagName);
            if(tagName !== tagExp && attrExpPresent){
              childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
            }
            this.addChild(currentNode, childNode, jPath);
            jPath = jPath.substr(0, jPath.lastIndexOf("."));
          }
    //opening tag
          else {
            const childNode = new xmlNode( tagName);
            this.tagsNodeStack.push(currentNode);
            
            if(tagName !== tagExp && attrExpPresent){
              childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
            }
            this.addChild(currentNode, childNode, jPath);
            currentNode = childNode;
          }
          textData = "";
          i = closeIndex;
        }
      }
    }else {
      textData += xmlData[i];
    }
  }
  return xmlObj.child;
};

function addChild(currentNode, childNode, jPath){
  const result = this.options.updateTag(childNode.tagname, jPath, childNode[":@"]);
  if(result === false);else if(typeof result === "string"){
    childNode.tagname = result;
    currentNode.addChild(childNode);
  }else {
    currentNode.addChild(childNode);
  }
}

const replaceEntitiesValue$1 = function(val){

  if(this.options.processEntities){
    for(let entityName in this.docTypeEntities){
      const entity = this.docTypeEntities[entityName];
      val = val.replace( entity.regx, entity.val);
    }
    for(let entityName in this.lastEntities){
      const entity = this.lastEntities[entityName];
      val = val.replace( entity.regex, entity.val);
    }
    if(this.options.htmlEntities){
      for(let entityName in this.htmlEntities){
        const entity = this.htmlEntities[entityName];
        val = val.replace( entity.regex, entity.val);
      }
    }
    val = val.replace( this.ampEntity.regex, this.ampEntity.val);
  }
  return val;
};
function saveTextToParentTag(textData, currentNode, jPath, isLeafNode) {
  if (textData) { //store previously collected data as textNode
    if(isLeafNode === undefined) isLeafNode = Object.keys(currentNode.child).length === 0;
    
    textData = this.parseTextData(textData,
      currentNode.tagname,
      jPath,
      false,
      currentNode[":@"] ? Object.keys(currentNode[":@"]).length !== 0 : false,
      isLeafNode);

    if (textData !== undefined && textData !== "")
      currentNode.add(this.options.textNodeName, textData);
    textData = "";
  }
  return textData;
}

//TODO: use jPath to simplify the logic
/**
 * 
 * @param {string[]} stopNodes 
 * @param {string} jPath
 * @param {string} currentTagName 
 */
function isItStopNode(stopNodes, jPath, currentTagName){
  const allNodesExp = "*." + currentTagName;
  for (const stopNodePath in stopNodes) {
    const stopNodeExp = stopNodes[stopNodePath];
    if( allNodesExp === stopNodeExp || jPath === stopNodeExp  ) return true;
  }
  return false;
}

/**
 * Returns the tag Expression and where it is ending handling single-double quotes situation
 * @param {string} xmlData 
 * @param {number} i starting index
 * @returns 
 */
function tagExpWithClosingIndex(xmlData, i, closingChar = ">"){
  let attrBoundary;
  let tagExp = "";
  for (let index = i; index < xmlData.length; index++) {
    let ch = xmlData[index];
    if (attrBoundary) {
        if (ch === attrBoundary) attrBoundary = "";//reset
    } else if (ch === '"' || ch === "'") {
        attrBoundary = ch;
    } else if (ch === closingChar[0]) {
      if(closingChar[1]){
        if(xmlData[index + 1] === closingChar[1]){
          return {
            data: tagExp,
            index: index
          }
        }
      }else {
        return {
          data: tagExp,
          index: index
        }
      }
    } else if (ch === '\t') {
      ch = " ";
    }
    tagExp += ch;
  }
}

function findClosingIndex(xmlData, str, i, errMsg){
  const closingIndex = xmlData.indexOf(str, i);
  if(closingIndex === -1){
    throw new Error(errMsg)
  }else {
    return closingIndex + str.length - 1;
  }
}

function readTagExp(xmlData,i, removeNSPrefix, closingChar = ">"){
  const result = tagExpWithClosingIndex(xmlData, i+1, closingChar);
  if(!result) return;
  let tagExp = result.data;
  const closeIndex = result.index;
  const separatorIndex = tagExp.search(/\s/);
  let tagName = tagExp;
  let attrExpPresent = true;
  if(separatorIndex !== -1){//separate tag name and attributes expression
    tagName = tagExp.substring(0, separatorIndex);
    tagExp = tagExp.substring(separatorIndex + 1).trimStart();
  }

  const rawTagName = tagName;
  if(removeNSPrefix){
    const colonIndex = tagName.indexOf(":");
    if(colonIndex !== -1){
      tagName = tagName.substr(colonIndex+1);
      attrExpPresent = tagName !== result.data.substr(colonIndex + 1);
    }
  }

  return {
    tagName: tagName,
    tagExp: tagExp,
    closeIndex: closeIndex,
    attrExpPresent: attrExpPresent,
    rawTagName: rawTagName,
  }
}
/**
 * find paired tag for a stop node
 * @param {string} xmlData 
 * @param {string} tagName 
 * @param {number} i 
 */
function readStopNodeData(xmlData, tagName, i){
  const startIndex = i;
  // Starting at 1 since we already have an open tag
  let openTagCount = 1;

  for (; i < xmlData.length; i++) {
    if( xmlData[i] === "<"){ 
      if (xmlData[i+1] === "/") {//close tag
          const closeIndex = findClosingIndex(xmlData, ">", i, `${tagName} is not closed`);
          let closeTagName = xmlData.substring(i+2,closeIndex).trim();
          if(closeTagName === tagName){
            openTagCount--;
            if (openTagCount === 0) {
              return {
                tagContent: xmlData.substring(startIndex, i),
                i : closeIndex
              }
            }
          }
          i=closeIndex;
        } else if(xmlData[i+1] === '?') { 
          const closeIndex = findClosingIndex(xmlData, "?>", i+1, "StopNode is not closed.");
          i=closeIndex;
        } else if(xmlData.substr(i + 1, 3) === '!--') { 
          const closeIndex = findClosingIndex(xmlData, "-->", i+3, "StopNode is not closed.");
          i=closeIndex;
        } else if(xmlData.substr(i + 1, 2) === '![') { 
          const closeIndex = findClosingIndex(xmlData, "]]>", i, "StopNode is not closed.") - 2;
          i=closeIndex;
        } else {
          const tagData = readTagExp(xmlData, i, '>');

          if (tagData) {
            const openTagName = tagData && tagData.tagName;
            if (openTagName === tagName && tagData.tagExp[tagData.tagExp.length-1] !== "/") {
              openTagCount++;
            }
            i=tagData.closeIndex;
          }
        }
      }
  }//end for loop
}

function parseValue(val, shouldParse, options) {
  if (shouldParse && typeof val === 'string') {
    //console.log(options)
    const newval = val.trim();
    if(newval === 'true' ) return true;
    else if(newval === 'false' ) return false;
    else return toNumber(val, options);
  } else {
    if (util.isExist(val)) {
      return val;
    } else {
      return '';
    }
  }
}


var OrderedObjParser_1 = OrderedObjParser$1;

var node2json = {};

/**
 * 
 * @param {array} node 
 * @param {any} options 
 * @returns 
 */
function prettify$1(node, options){
  return compress( node, options);
}

/**
 * 
 * @param {array} arr 
 * @param {object} options 
 * @param {string} jPath 
 * @returns object
 */
function compress(arr, options, jPath){
  let text;
  const compressedObj = {};
  for (let i = 0; i < arr.length; i++) {
    const tagObj = arr[i];
    const property = propName$1(tagObj);
    let newJpath = "";
    if(jPath === undefined) newJpath = property;
    else newJpath = jPath + "." + property;

    if(property === options.textNodeName){
      if(text === undefined) text = tagObj[property];
      else text += "" + tagObj[property];
    }else if(property === undefined){
      continue;
    }else if(tagObj[property]){
      
      let val = compress(tagObj[property], options, newJpath);
      const isLeaf = isLeafTag(val, options);

      if(tagObj[":@"]){
        assignAttributes( val, tagObj[":@"], newJpath, options);
      }else if(Object.keys(val).length === 1 && val[options.textNodeName] !== undefined && !options.alwaysCreateTextNode){
        val = val[options.textNodeName];
      }else if(Object.keys(val).length === 0){
        if(options.alwaysCreateTextNode) val[options.textNodeName] = "";
        else val = "";
      }

      if(compressedObj[property] !== undefined && compressedObj.hasOwnProperty(property)) {
        if(!Array.isArray(compressedObj[property])) {
            compressedObj[property] = [ compressedObj[property] ];
        }
        compressedObj[property].push(val);
      }else {
        //TODO: if a node is not an array, then check if it should be an array
        //also determine if it is a leaf node
        if (options.isArray(property, newJpath, isLeaf )) {
          compressedObj[property] = [val];
        }else {
          compressedObj[property] = val;
        }
      }
    }
    
  }
  // if(text && text.length > 0) compressedObj[options.textNodeName] = text;
  if(typeof text === "string"){
    if(text.length > 0) compressedObj[options.textNodeName] = text;
  }else if(text !== undefined) compressedObj[options.textNodeName] = text;
  return compressedObj;
}

function propName$1(obj){
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if(key !== ":@") return key;
  }
}

function assignAttributes(obj, attrMap, jpath, options){
  if (attrMap) {
    const keys = Object.keys(attrMap);
    const len = keys.length; //don't make it inline
    for (let i = 0; i < len; i++) {
      const atrrName = keys[i];
      if (options.isArray(atrrName, jpath + "." + atrrName, true, true)) {
        obj[atrrName] = [ attrMap[atrrName] ];
      } else {
        obj[atrrName] = attrMap[atrrName];
      }
    }
  }
}

function isLeafTag(obj, options){
  const { textNodeName } = options;
  const propCount = Object.keys(obj).length;
  
  if (propCount === 0) {
    return true;
  }

  if (
    propCount === 1 &&
    (obj[textNodeName] || typeof obj[textNodeName] === "boolean" || obj[textNodeName] === 0)
  ) {
    return true;
  }

  return false;
}
node2json.prettify = prettify$1;

const { buildOptions} = OptionsBuilder;
const OrderedObjParser = OrderedObjParser_1;
const { prettify} = node2json;
const validator$1 = validator$2;

let XMLParser$1 = class XMLParser{
    
    constructor(options){
        this.externalEntities = {};
        this.options = buildOptions(options);
        
    }
    /**
     * Parse XML dats to JS object 
     * @param {string|Buffer} xmlData 
     * @param {boolean|Object} validationOption 
     */
    parse(xmlData,validationOption){
        if(typeof xmlData === "string");else if( xmlData.toString){
            xmlData = xmlData.toString();
        }else {
            throw new Error("XML data is accepted in String or Bytes[] form.")
        }
        if( validationOption){
            if(validationOption === true) validationOption = {}; //validate with default options
            
            const result = validator$1.validate(xmlData, validationOption);
            if (result !== true) {
              throw Error( `${result.err.msg}:${result.err.line}:${result.err.col}` )
            }
          }
        const orderedObjParser = new OrderedObjParser(this.options);
        orderedObjParser.addExternalEntities(this.externalEntities);
        const orderedResult = orderedObjParser.parseXml(xmlData);
        if(this.options.preserveOrder || orderedResult === undefined) return orderedResult;
        else return prettify(orderedResult, this.options);
    }

    /**
     * Add Entity which is not by default supported by this library
     * @param {string} key 
     * @param {string} value 
     */
    addEntity(key, value){
        if(value.indexOf("&") !== -1){
            throw new Error("Entity value can't have '&'")
        }else if(key.indexOf("&") !== -1 || key.indexOf(";") !== -1){
            throw new Error("An entity must be set without '&' and ';'. Eg. use '#xD' for '&#xD;'")
        }else if(value === "&"){
            throw new Error("An entity with value '&' is not permitted");
        }else {
            this.externalEntities[key] = value;
        }
    }
};

var XMLParser_1 = XMLParser$1;

const EOL = "\n";

/**
 * 
 * @param {array} jArray 
 * @param {any} options 
 * @returns 
 */
function toXml(jArray, options) {
    let indentation = "";
    if (options.format && options.indentBy.length > 0) {
        indentation = EOL;
    }
    return arrToStr(jArray, options, "", indentation);
}

function arrToStr(arr, options, jPath, indentation) {
    let xmlStr = "";
    let isPreviousElementTag = false;

    for (let i = 0; i < arr.length; i++) {
        const tagObj = arr[i];
        const tagName = propName(tagObj);
        if(tagName === undefined) continue;

        let newJPath = "";
        if (jPath.length === 0) newJPath = tagName;
        else newJPath = `${jPath}.${tagName}`;

        if (tagName === options.textNodeName) {
            let tagText = tagObj[tagName];
            if (!isStopNode(newJPath, options)) {
                tagText = options.tagValueProcessor(tagName, tagText);
                tagText = replaceEntitiesValue(tagText, options);
            }
            if (isPreviousElementTag) {
                xmlStr += indentation;
            }
            xmlStr += tagText;
            isPreviousElementTag = false;
            continue;
        } else if (tagName === options.cdataPropName) {
            if (isPreviousElementTag) {
                xmlStr += indentation;
            }
            xmlStr += `<![CDATA[${tagObj[tagName][0][options.textNodeName]}]]>`;
            isPreviousElementTag = false;
            continue;
        } else if (tagName === options.commentPropName) {
            xmlStr += indentation + `<!--${tagObj[tagName][0][options.textNodeName]}-->`;
            isPreviousElementTag = true;
            continue;
        } else if (tagName[0] === "?") {
            const attStr = attr_to_str(tagObj[":@"], options);
            const tempInd = tagName === "?xml" ? "" : indentation;
            let piTextNodeName = tagObj[tagName][0][options.textNodeName];
            piTextNodeName = piTextNodeName.length !== 0 ? " " + piTextNodeName : ""; //remove extra spacing
            xmlStr += tempInd + `<${tagName}${piTextNodeName}${attStr}?>`;
            isPreviousElementTag = true;
            continue;
        }
        let newIdentation = indentation;
        if (newIdentation !== "") {
            newIdentation += options.indentBy;
        }
        const attStr = attr_to_str(tagObj[":@"], options);
        const tagStart = indentation + `<${tagName}${attStr}`;
        const tagValue = arrToStr(tagObj[tagName], options, newJPath, newIdentation);
        if (options.unpairedTags.indexOf(tagName) !== -1) {
            if (options.suppressUnpairedNode) xmlStr += tagStart + ">";
            else xmlStr += tagStart + "/>";
        } else if ((!tagValue || tagValue.length === 0) && options.suppressEmptyNode) {
            xmlStr += tagStart + "/>";
        } else if (tagValue && tagValue.endsWith(">")) {
            xmlStr += tagStart + `>${tagValue}${indentation}</${tagName}>`;
        } else {
            xmlStr += tagStart + ">";
            if (tagValue && indentation !== "" && (tagValue.includes("/>") || tagValue.includes("</"))) {
                xmlStr += indentation + options.indentBy + tagValue + indentation;
            } else {
                xmlStr += tagValue;
            }
            xmlStr += `</${tagName}>`;
        }
        isPreviousElementTag = true;
    }

    return xmlStr;
}

function propName(obj) {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if(!obj.hasOwnProperty(key)) continue;
        if (key !== ":@") return key;
    }
}

function attr_to_str(attrMap, options) {
    let attrStr = "";
    if (attrMap && !options.ignoreAttributes) {
        for (let attr in attrMap) {
            if(!attrMap.hasOwnProperty(attr)) continue;
            let attrVal = options.attributeValueProcessor(attr, attrMap[attr]);
            attrVal = replaceEntitiesValue(attrVal, options);
            if (attrVal === true && options.suppressBooleanAttributes) {
                attrStr += ` ${attr.substr(options.attributeNamePrefix.length)}`;
            } else {
                attrStr += ` ${attr.substr(options.attributeNamePrefix.length)}="${attrVal}"`;
            }
        }
    }
    return attrStr;
}

function isStopNode(jPath, options) {
    jPath = jPath.substr(0, jPath.length - options.textNodeName.length - 1);
    let tagName = jPath.substr(jPath.lastIndexOf(".") + 1);
    for (let index in options.stopNodes) {
        if (options.stopNodes[index] === jPath || options.stopNodes[index] === "*." + tagName) return true;
    }
    return false;
}

function replaceEntitiesValue(textValue, options) {
    if (textValue && textValue.length > 0 && options.processEntities) {
        for (let i = 0; i < options.entities.length; i++) {
            const entity = options.entities[i];
            textValue = textValue.replace(entity.regex, entity.val);
        }
    }
    return textValue;
}
var orderedJs2Xml = toXml;

//parse Empty Node as self closing node
const buildFromOrderedJs = orderedJs2Xml;
const getIgnoreAttributesFn = ignoreAttributes;

const defaultOptions = {
  attributeNamePrefix: '@_',
  attributesGroupName: false,
  textNodeName: '#text',
  ignoreAttributes: true,
  cdataPropName: false,
  format: false,
  indentBy: '  ',
  suppressEmptyNode: false,
  suppressUnpairedNode: true,
  suppressBooleanAttributes: true,
  tagValueProcessor: function(key, a) {
    return a;
  },
  attributeValueProcessor: function(attrName, a) {
    return a;
  },
  preserveOrder: false,
  commentPropName: false,
  unpairedTags: [],
  entities: [
    { regex: new RegExp("&", "g"), val: "&amp;" },//it must be on top
    { regex: new RegExp(">", "g"), val: "&gt;" },
    { regex: new RegExp("<", "g"), val: "&lt;" },
    { regex: new RegExp("\'", "g"), val: "&apos;" },
    { regex: new RegExp("\"", "g"), val: "&quot;" }
  ],
  processEntities: true,
  stopNodes: [],
  // transformTagName: false,
  // transformAttributeName: false,
  oneListGroup: false
};

function Builder(options) {
  this.options = Object.assign({}, defaultOptions, options);
  if (this.options.ignoreAttributes === true || this.options.attributesGroupName) {
    this.isAttribute = function(/*a*/) {
      return false;
    };
  } else {
    this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
    this.attrPrefixLen = this.options.attributeNamePrefix.length;
    this.isAttribute = isAttribute;
  }

  this.processTextOrObjNode = processTextOrObjNode;

  if (this.options.format) {
    this.indentate = indentate;
    this.tagEndChar = '>\n';
    this.newLine = '\n';
  } else {
    this.indentate = function() {
      return '';
    };
    this.tagEndChar = '>';
    this.newLine = '';
  }
}

Builder.prototype.build = function(jObj) {
  if(this.options.preserveOrder){
    return buildFromOrderedJs(jObj, this.options);
  }else {
    if(Array.isArray(jObj) && this.options.arrayNodeName && this.options.arrayNodeName.length > 1){
      jObj = {
        [this.options.arrayNodeName] : jObj
      };
    }
    return this.j2x(jObj, 0, []).val;
  }
};

Builder.prototype.j2x = function(jObj, level, ajPath) {
  let attrStr = '';
  let val = '';
  const jPath = ajPath.join('.');
  for (let key in jObj) {
    if(!Object.prototype.hasOwnProperty.call(jObj, key)) continue;
    if (typeof jObj[key] === 'undefined') {
      // supress undefined node only if it is not an attribute
      if (this.isAttribute(key)) {
        val += '';
      }
    } else if (jObj[key] === null) {
      // null attribute should be ignored by the attribute list, but should not cause the tag closing
      if (this.isAttribute(key)) {
        val += '';
      } else if (key[0] === '?') {
        val += this.indentate(level) + '<' + key + '?' + this.tagEndChar;
      } else {
        val += this.indentate(level) + '<' + key + '/' + this.tagEndChar;
      }
      // val += this.indentate(level) + '<' + key + '/' + this.tagEndChar;
    } else if (jObj[key] instanceof Date) {
      val += this.buildTextValNode(jObj[key], key, '', level);
    } else if (typeof jObj[key] !== 'object') {
      //premitive type
      const attr = this.isAttribute(key);
      if (attr && !this.ignoreAttributesFn(attr, jPath)) {
        attrStr += this.buildAttrPairStr(attr, '' + jObj[key]);
      } else if (!attr) {
        //tag value
        if (key === this.options.textNodeName) {
          let newval = this.options.tagValueProcessor(key, '' + jObj[key]);
          val += this.replaceEntitiesValue(newval);
        } else {
          val += this.buildTextValNode(jObj[key], key, '', level);
        }
      }
    } else if (Array.isArray(jObj[key])) {
      //repeated nodes
      const arrLen = jObj[key].length;
      let listTagVal = "";
      let listTagAttr = "";
      for (let j = 0; j < arrLen; j++) {
        const item = jObj[key][j];
        if (typeof item === 'undefined') ; else if (item === null) {
          if(key[0] === "?") val += this.indentate(level) + '<' + key + '?' + this.tagEndChar;
          else val += this.indentate(level) + '<' + key + '/' + this.tagEndChar;
          // val += this.indentate(level) + '<' + key + '/' + this.tagEndChar;
        } else if (typeof item === 'object') {
          if(this.options.oneListGroup){
            const result = this.j2x(item, level + 1, ajPath.concat(key));
            listTagVal += result.val;
            if (this.options.attributesGroupName && item.hasOwnProperty(this.options.attributesGroupName)) {
              listTagAttr += result.attrStr;
            }
          }else {
            listTagVal += this.processTextOrObjNode(item, key, level, ajPath);
          }
        } else {
          if (this.options.oneListGroup) {
            let textValue = this.options.tagValueProcessor(key, item);
            textValue = this.replaceEntitiesValue(textValue);
            listTagVal += textValue;
          } else {
            listTagVal += this.buildTextValNode(item, key, '', level);
          }
        }
      }
      if(this.options.oneListGroup){
        listTagVal = this.buildObjectNode(listTagVal, key, listTagAttr, level);
      }
      val += listTagVal;
    } else {
      //nested node
      if (this.options.attributesGroupName && key === this.options.attributesGroupName) {
        const Ks = Object.keys(jObj[key]);
        const L = Ks.length;
        for (let j = 0; j < L; j++) {
          attrStr += this.buildAttrPairStr(Ks[j], '' + jObj[key][Ks[j]]);
        }
      } else {
        val += this.processTextOrObjNode(jObj[key], key, level, ajPath);
      }
    }
  }
  return {attrStr: attrStr, val: val};
};

Builder.prototype.buildAttrPairStr = function(attrName, val){
  val = this.options.attributeValueProcessor(attrName, '' + val);
  val = this.replaceEntitiesValue(val);
  if (this.options.suppressBooleanAttributes && val === "true") {
    return ' ' + attrName;
  } else return ' ' + attrName + '="' + val + '"';
};

function processTextOrObjNode (object, key, level, ajPath) {
  const result = this.j2x(object, level + 1, ajPath.concat(key));
  if (object[this.options.textNodeName] !== undefined && Object.keys(object).length === 1) {
    return this.buildTextValNode(object[this.options.textNodeName], key, result.attrStr, level);
  } else {
    return this.buildObjectNode(result.val, key, result.attrStr, level);
  }
}

Builder.prototype.buildObjectNode = function(val, key, attrStr, level) {
  if(val === ""){
    if(key[0] === "?") return  this.indentate(level) + '<' + key + attrStr+ '?' + this.tagEndChar;
    else {
      return this.indentate(level) + '<' + key + attrStr + this.closeTag(key) + this.tagEndChar;
    }
  }else {

    let tagEndExp = '</' + key + this.tagEndChar;
    let piClosingChar = "";
    
    if(key[0] === "?") {
      piClosingChar = "?";
      tagEndExp = "";
    }
  
    // attrStr is an empty string in case the attribute came as undefined or null
    if ((attrStr || attrStr === '') && val.indexOf('<') === -1) {
      return ( this.indentate(level) + '<' +  key + attrStr + piClosingChar + '>' + val + tagEndExp );
    } else if (this.options.commentPropName !== false && key === this.options.commentPropName && piClosingChar.length === 0) {
      return this.indentate(level) + `<!--${val}-->` + this.newLine;
    }else {
      return (
        this.indentate(level) + '<' + key + attrStr + piClosingChar + this.tagEndChar +
        val +
        this.indentate(level) + tagEndExp    );
    }
  }
};

Builder.prototype.closeTag = function(key){
  let closeTag = "";
  if(this.options.unpairedTags.indexOf(key) !== -1){ //unpaired
    if(!this.options.suppressUnpairedNode) closeTag = "/";
  }else if(this.options.suppressEmptyNode){ //empty
    closeTag = "/";
  }else {
    closeTag = `></${key}`;
  }
  return closeTag;
};

Builder.prototype.buildTextValNode = function(val, key, attrStr, level) {
  if (this.options.cdataPropName !== false && key === this.options.cdataPropName) {
    return this.indentate(level) + `<![CDATA[${val}]]>` +  this.newLine;
  }else if (this.options.commentPropName !== false && key === this.options.commentPropName) {
    return this.indentate(level) + `<!--${val}-->` +  this.newLine;
  }else if(key[0] === "?") {//PI tag
    return  this.indentate(level) + '<' + key + attrStr+ '?' + this.tagEndChar; 
  }else {
    let textValue = this.options.tagValueProcessor(key, val);
    textValue = this.replaceEntitiesValue(textValue);
  
    if( textValue === ''){
      return this.indentate(level) + '<' + key + attrStr + this.closeTag(key) + this.tagEndChar;
    }else {
      return this.indentate(level) + '<' + key + attrStr + '>' +
         textValue +
        '</' + key + this.tagEndChar;
    }
  }
};

Builder.prototype.replaceEntitiesValue = function(textValue){
  if(textValue && textValue.length > 0 && this.options.processEntities){
    for (let i=0; i<this.options.entities.length; i++) {
      const entity = this.options.entities[i];
      textValue = textValue.replace(entity.regex, entity.val);
    }
  }
  return textValue;
};

function indentate(level) {
  return this.options.indentBy.repeat(level);
}

function isAttribute(name /*, options*/) {
  if (name.startsWith(this.options.attributeNamePrefix) && name !== this.options.textNodeName) {
    return name.substr(this.attrPrefixLen);
  } else {
    return false;
  }
}

var json2xml = Builder;

const validator = validator$2;
const XMLParser = XMLParser_1;
const XMLBuilder = json2xml;

var fxp = {
  XMLParser: XMLParser,
  XMLValidator: validator,
  XMLBuilder: XMLBuilder
};

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
var byteToHex = [];
for (var i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  //
  // Note to future-self: No, you can't remove the `toLowerCase()` call.
  // REF: https://github.com/uuidjs/uuid/pull/677#issuecomment-1757351351
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// Unique ID creation requires a high quality random # generator. In the browser we therefore
// require the crypto API and do not support built-in fallback to lower quality random number
// generators (like Math.random()).

var getRandomValues;
var rnds8 = new Uint8Array(16);
function rng() {
  // lazy load so that environments that need to polyfill have a chance to do so
  if (!getRandomValues) {
    // getRandomValues needs to be invoked in a context where "this" is a Crypto implementation.
    getRandomValues = typeof crypto !== 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);
    if (!getRandomValues) {
      throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
    }
  }
  return getRandomValues(rnds8);
}

var randomUUID = typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID.bind(crypto);
var native = {
  randomUUID
};

function v4(options, buf, offset) {
  if (native.randomUUID && !buf && !options) {
    return native.randomUUID();
  }
  options = options || {};
  var rnds = options.random || (options.rng || rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = rnds[6] & 0x0f | 0x40;
  rnds[8] = rnds[8] & 0x3f | 0x80;
  return unsafeStringify(rnds);
}

/**
 * Base error class for all ISO 20022 related errors in the library.
 * Extends the native Error class with proper stack trace capture.
 */
class Iso20022JsError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        // Maintains proper stack trace for where the error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
/**
 * Error thrown when XML parsing or validation fails.
 * This error indicates that the provided XML is malformed or does not conform to expected structure.
 */
class InvalidXmlError extends Iso20022JsError {
    constructor(message) {
        super(message);
    }
}
/**
 * Error thrown when XML namespace validation fails.
 * This error indicates that the XML document contains invalid or missing required ISO 20022 namespaces.
 */
class InvalidXmlNamespaceError extends Iso20022JsError {
    constructor(message) {
        super(message);
    }
}
class InvalidStructureError extends Iso20022JsError {
    constructor(message) {
        super(message);
    }
}

function getCurrencyPrecision(currency) {
    switch (currency) {
        case 'BHD': // Bahraini Dinar
        case 'IQD': // Iraqi Dinar
        case 'JOD': // Jordanian Dinar
        case 'KWD': // Kuwaiti Dinar
        case 'LYD': // Libyan Dinar
        case 'OMR': // Omani Rial
        case 'TND': // Tunisian Dinar
            return 3;
        case 'CLF': // Unidad de Fomento (Chile)
            return 4;
        case 'BIF': // Burundian Franc
        case 'BYN': // Belarusian Ruble
        case 'CVE': // Cape Verdean Escudo
        case 'DJF': // Djiboutian Franc
        case 'GNF': // Guinean Franc
        case 'ISK': // Icelandic Krona
        case 'JPY': // Japanese Yen
        case 'KMF': // Comorian Franc
        case 'KRW': // South Korean Won
        case 'PYG': // Paraguayan Guarani
        case 'RWF': // Rwandan Franc
        case 'UGX': // Ugandan Shilling
        case 'UYI': // Uruguayan Peso (Indexed Units)
        case 'VND': // Vietnamese Dong
        case 'VUV': // Vanuatu Vatu
        case 'XAF': // Central African CFA Franc
        case 'XOF': // West African CFA Franc
        case 'XPF': // CFP Franc
            return 0;
        default:
            return 2; // Default to 2 decimal places for most currencies
    }
}

const parseAccount = (account) => {
    // Return just IBAN if it exists, else detailed local account details
    if (account.Id.IBAN) {
        return {
            iban: account.Id.IBAN,
        };
    }
    // TODO: Add support for .Tp.Cd and .Tp.Prtry
    return {
        ...(account.Id?.Othr?.Id && { accountNumber: String(account.Id.Othr.Id) }),
        ...(account.Nm && { name: account.Nm }),
        ...(account.Ccy && { currency: account.Ccy }),
    };
};
const exportAccount = (account) => {
    const obj = {};
    if (account.iban) {
        obj.Id = { IBAN: account.iban };
    }
    else {
        obj.Id = {
            Othr: {
                Id: account.accountNumber,
            },
        };
        obj.Ccy = account.currency;
        obj.Nm = account.name;
    }
    return obj;
};
const parseAccountIdentification = (accountId) => {
    if (accountId.IBAN) {
        return {
            iban: accountId.IBAN,
        };
    }
    else {
        return {
            id: accountId.Othr?.Id,
            schemeName: accountId.Othr?.SchmeNm?.Cd || accountId.Othr?.SchmeNm?.Prtry,
            issuer: accountId.Othr?.Issr,
        };
    }
};
const exportAccountIdentification = (accountId) => {
    if (accountId.iban) {
        return { IBAN: accountId.iban };
    }
    else {
        const obj = {
            Othr: {
                Id: accountId.id,
            }
        };
        if (accountId.schemeName) {
            obj.Othr.SchmeNm = { Cd: accountId.schemeName }; // TODO: Add support for Prtry scheme name
        }
        if (accountId.issuer) {
            obj.Othr.Issr = accountId.issuer;
        }
        return obj;
    }
};
// TODO: Add both BIC and ABA routing numbers at the same time
const parseAgent = (agent) => {
    // Get BIC if it exists first
    if (agent.FinInstnId.BIC) {
        return {
            bic: agent.FinInstnId.BIC,
        };
    }
    return {
        abaRoutingNumber: (agent.FinInstnId.Othr?.Id || agent.FinInstnId.ClrSysMmbId.MmbId)?.toString(),
    };
};
const exportAgent = (agent) => {
    const obj = {
        FinInstnId: {},
    };
    if (agent.bic) {
        obj.FinInstnId.BIC = agent.bic;
    }
    else if (agent.abaRoutingNumber) {
        obj.FinInstnId.Othr = { Id: agent.abaRoutingNumber };
    }
    return obj;
};
// Parse raw currency data, turn into Dinero object and turn into minor units
const parseAmountToMinorUnits = (rawAmount, currency = 'USD') => {
    const currencyObject = Dinero({
        currency: currency,
        precision: getCurrencyPrecision(currency),
    });
    // Also make sure Javascript number parsing error do not happen.
    return Math.floor(Number(rawAmount) * 10 ** currencyObject.getPrecision());
};
const exportAmountToString = (amount, currency = 'USD') => {
    const currencyObject = Dinero({
        amount,
        currency: currency,
        precision: getCurrencyPrecision(currency),
    });
    const precision = currencyObject.getPrecision();
    const zeroes = '0'.repeat(precision);
    return currencyObject.toFormat('0' + (zeroes.length > 0 ? '.' + zeroes : ''));
};
const parseDate = (dateElement) => {
    // Find the date element, which can be DtTm or Dt
    const date = dateElement.DtTm || dateElement.Dt || dateElement;
    return new Date(date);
};
const parseParty = (party) => {
    return {
        id: party.Id?.OrgId?.Othr?.Id,
        name: party.Nm,
    };
};
const parseRecipient = (recipient) => {
    return {
        id: recipient.Id?.OrgId?.Othr?.Id,
        name: recipient.Nm,
    };
};
const exportRecipient = (recipient) => {
    return {
        Id: recipient.id ? { OrgId: { Othr: { Id: recipient.id } } } : undefined,
        Nm: recipient.name,
    };
};
// Standardize into a single string
const parseAdditionalInformation = (additionalInformation) => {
    if (!additionalInformation) {
        return undefined;
    }
    if (Array.isArray(additionalInformation)) {
        return additionalInformation.join('\n');
    }
    else {
        return additionalInformation;
    }
};
const parseMessageHeader = (rawHeader) => {
    return {
        id: rawHeader.MsgId,
        creationDateTime: rawHeader.CreDtTm ? parseDate(rawHeader.CreDtTm) : undefined,
        queryName: rawHeader.QueryNm,
        requestType: rawHeader.ReqTp?.PmtCtrl || rawHeader.ReqTp?.Enqry || rawHeader.ReqTp?.Prtry,
        originalMessageHeader: rawHeader.OrgnlBizQry ? parseMessageHeader(rawHeader.OrgnlBizQry) : undefined,
    };
};
const exportMessageHeader = (header) => {
    const obj = {
        MsgId: header.id,
        CreDtTm: header.creationDateTime?.toISOString(),
    };
    if (header.originalMessageHeader) {
        obj.OrgnlMsgHdr = exportMessageHeader(header.originalMessageHeader);
    }
    if (header.requestType) {
        obj.ReqTp = { Prtry: header.requestType }; // TODO: Add support for PmtCtrl and Enqry types
    }
    if (header.queryName) {
        obj.QueryNm = header.queryName;
    }
    return obj;
};

const sanitize = (value, length) => {
    return value.slice(0, length);
};

/**
 * Abstract base class for ISO20022 payment initiation (PAIN) messages.
 * @abstract
 */
class PaymentInitiation {
    type;
    constructor({ type }) {
        this.type = type;
    }
    /**
     * Formats a party's information according to ISO20022 standards.
     * @param {Party} party - The party's information.
     * @returns {Object} Formatted XML party information.
     */
    party(party) {
        const result = {
            Nm: party.name,
        };
        // Only include address information if it exists
        if (party.address) {
            result.PstlAdr = {
                StrtNm: party.address.streetName,
                BldgNb: party.address.buildingNumber,
                PstCd: party.address.postalCode,
                TwnNm: party.address.townName,
                CtrySubDvsn: party.address.countrySubDivision,
                Ctry: party.address.country,
            };
        }
        return result;
    }
    /**
     * Formats an account according to ISO20022 standards.
     * This method handles both IBAN and non-IBAN accounts.
     *
     * @param {Account} account - The account to be formatted. Can be either an IBANAccount or a BaseAccount.
     * @returns {Object} An object representing the formatted account information.
     *                   For IBAN accounts, it returns an object with an IBAN identifier.
     *                   For non-IBAN accounts, it returns an object with an 'Other' identifier.
     *
     * @example
     * // For an IBAN account
     * account({ iban: 'DE89370400440532013000' })
     * // Returns: { Id: { IBAN: 'DE89370400440532013000' } }
     *
     * @example
     * // For a non-IBAN account
     * account({ accountNumber: '1234567890' })
     * // Returns: { Id: { Othr: { Id: '1234567890' } } }
     */
    account(account) {
        if (account.iban) {
            return this.internationalAccount(account);
        }
        return {
            Id: {
                Othr: {
                    Id: account.accountNumber,
                },
            },
        };
    }
    /**
     * Formats an IBAN account according to ISO20022 standards.
     * @param {IBANAccount} account - The IBAN account information.
     * @returns {Object} Formatted XML IBAN account information.
     */
    internationalAccount(account) {
        return {
            Id: {
                IBAN: account.iban,
            },
        };
    }
    /**
     * Formats an agent according to ISO20022 standards.
     * This method handles both BIC and ABA agents.
     *
     * @param {Agent} agent - The agent to be formatted. Can be either a BICAgent or an ABAAgent.
     * @returns {Object} An object representing the formatted agent information.
     *                   For BIC agents, it returns an object with a BIC identifier.
     *                   For ABA agents, it returns an object with clearing system member identification.
     *
     * @example
     * // For a BIC agent
     * agent({ bic: 'BOFAUS3NXXX' })
     * // Returns: { FinInstnId: { BIC: 'BOFAUS3NXXX' } }
     *
     * @example
     * // For an ABA agent
     * agent({ abaRoutingNumber: '026009593' })
     * // Returns: { FinInstnId: { ClrSysMmbId: { MmbId: '026009593' } } }
     */
    agent(agent) {
        if (agent.bic !== undefined) {
            return {
                FinInstnId: {
                    BIC: agent.bic,
                },
            };
        }
        else {
            return {
                FinInstnId: {
                    ClrSysMmbId: {
                        ClrSysId: {
                            Cd: 'USABA',
                        },
                        MmbId: agent.abaRoutingNumber,
                    },
                },
            };
        }
    }
    /**
     * Returns the string representation of the payment initiation.
     * @returns {string} The serialized payment initiation.
     */
    toString() {
        return this.serialize();
    }
    static getBuilder() {
        return new fxp.XMLBuilder({
            ignoreAttributes: false,
            attributeNamePrefix: '@',
            textNodeName: '#',
            format: true,
        });
    }
}

/**
 * Represents a SWIFT Credit Payment v3 Initiation message (pain.001.001.03).
 * @class
 * @extends PaymentInitiation
 * @param {SWIFTCreditPaymentInitiationConfig} config - The configuration for the SWIFT Credit Payment Initiation message.
 * @example
 * ```typescript
 * // Creating a payment message
 * const payment = new SWIFTCreditPaymentInitiation({
 *   ...
 * });
 * // Uploading to fiatwebservices.com
 * client.paymentTransfers.create(payment);
 * // Parsing from XML
 * const xml = '<xml>...</xml>';
 * const parsedTransfer = SWIFTCreditPaymentInitiation.fromXML(xml);
 * ```
 * @see {@link https://docs.iso20022js.com/pain/sepacredit} for more information.
 */
class SWIFTCreditPaymentInitiation extends PaymentInitiation {
    initiatingParty;
    messageId;
    creationDate;
    paymentInstructions;
    paymentInformationId;
    /**
     * Creates an instance of SWIFTCreditPaymentInitiation.
     * @param {SWIFTCreditPaymentInitiationConfig} config - The configuration object.
     */
    constructor(config) {
        super({ type: "swift" });
        this.initiatingParty = config.initiatingParty;
        this.paymentInstructions = config.paymentInstructions;
        this.messageId =
            config.messageId || v4().replace(/-/g, '').substring(0, 35);
        this.creationDate = config.creationDate || new Date();
        this.paymentInformationId = sanitize(v4(), 35);
        this.validate();
    }
    /**
     * Validates the payment initiation data has the information required to create a valid XML file.
     * @private
     * @throws {Error} If messageId exceeds 35 characters.
     * @throws {Error} If any creditor has incomplete address information.
     */
    validate() {
        if (this.messageId.length > 35) {
            throw new Error('messageId must not exceed 35 characters');
        }
        // Validate that all creditors have complete addresses
        // According to spec, the country is required for all addresses
        const creditorWithIncompleteAddress = this.paymentInstructions.find(instruction => {
            const address = instruction.creditor.address;
            return !address || !address.country;
        });
        if (creditorWithIncompleteAddress) {
            throw new Error('All creditors must have complete addresses (street name, building number, postal code, town name, and country)');
        }
        // Add more validation as needed
    }
    /**
     * Generates payment information for a single payment instruction.
     * @param {SWIFTCreditPaymentInstruction} paymentInstruction - The payment instruction.
     * @returns {Object} The credit transfer object.
     */
    creditTransfer(paymentInstruction) {
        const paymentInstructionId = sanitize(paymentInstruction.id || v4(), 35);
        const amount = Dinero({
            amount: paymentInstruction.amount,
            currency: paymentInstruction.currency,
        }).toUnit();
        return {
            PmtId: {
                InstrId: paymentInstructionId,
                EndToEndId: paymentInstructionId,
            },
            Amt: {
                InstdAmt: {
                    '#': amount,
                    '@Ccy': paymentInstruction.currency,
                },
            },
            // TODO: Add support for intermediary bank information
            // This is necessary when the SWIFT Payment needs to be routed through multiple banks in order to reach the recipient
            // intermediaryBanks will probably need to be an array of BICAgents. There needs to be an easy way to get this information for users
            CdtrAgt: this.agent(paymentInstruction.creditor.agent),
            Cdtr: this.party(paymentInstruction.creditor),
            CdtrAcct: this.internationalAccount(paymentInstruction.creditor.account),
            RmtInf: paymentInstruction.remittanceInformation
                ? {
                    Ustrd: paymentInstruction.remittanceInformation,
                }
                : undefined,
        };
    }
    /**
     * Serializes the payment initiation to an XML string.
     * @returns {string} The XML representation of the payment initiation.
     */
    static fromXML(rawXml) {
        const parser = new fxp.XMLParser({ ignoreAttributes: false });
        const xml = parser.parse(rawXml);
        if (!xml.Document) {
            throw new InvalidXmlError("Invalid XML format");
        }
        const namespace = (xml.Document['@_xmlns'] || xml.Document['@_Xmlns']);
        if (!namespace.startsWith('urn:iso:std:iso:20022:tech:xsd:pain.001.001')) {
            throw new InvalidXmlNamespaceError('Invalid PAIN.001 namespace');
        }
        const messageId = xml.Document.CstmrCdtTrfInitn.GrpHdr.MsgId;
        const creationDate = new Date(xml.Document.CstmrCdtTrfInitn.GrpHdr.CreDtTm);
        // Parse and validate accounts
        // Create base initiating party
        const baseInitiatingParty = {
            name: xml.Document.CstmrCdtTrfInitn.GrpHdr.InitgPty.Nm,
            id: xml.Document.CstmrCdtTrfInitn.GrpHdr.InitgPty.Id?.OrgId?.Othr?.Id,
            account: parseAccount(xml.Document.CstmrCdtTrfInitn.PmtInf.DbtrAcct),
            agent: {
                bic: xml.Document.CstmrCdtTrfInitn.PmtInf.DbtrAgt?.FinInstnId?.BIC
            }
        };
        const rawInstructions = Array.isArray(xml.Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf)
            ? xml.Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf
            : [xml.Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf];
        const paymentInstructions = rawInstructions.map((inst) => {
            const currency = inst.Amt.InstdAmt['@_Ccy'];
            const amount = parseAmountToMinorUnits(Number(inst.Amt.InstdAmt['#text']), currency);
            // Create base creditor party
            const creditor = {
                name: inst.Cdtr.Nm,
                agent: {
                    bic: inst.CdtrAgt?.FinInstnId?.BIC
                },
                account: (inst.CdtrAcct?.Id?.IBAN || inst.CdtrAcct?.Id?.Othr?.Id) ? parseAccount(inst.CdtrAcct) : undefined,
                address: {
                    streetName: inst.Cdtr.PstlAdr.StrtNm,
                    buildingNumber: inst.Cdtr.PstlAdr.BldgNb,
                    postalCode: inst.Cdtr.PstlAdr.PstCd,
                    townName: inst.Cdtr.PstlAdr.TwnNm,
                    countrySubDivision: inst.Cdtr.PstlAdr.CtrySubDvsn,
                    country: inst.Cdtr.PstlAdr.Ctry
                }
            };
            // Return instruction with validated data
            return {
                type: 'swift',
                direction: 'credit',
                ...(inst.PmtId.InstrId && { id: inst.PmtId.InstrId.toString() }),
                ...(inst.PmtId.EndToEndId && { endToEndId: inst.PmtId.EndToEndId.toString() }),
                amount,
                currency,
                creditor
            };
        });
        return new SWIFTCreditPaymentInitiation({
            messageId,
            creationDate,
            initiatingParty: baseInitiatingParty,
            paymentInstructions: paymentInstructions
        });
    }
    serialize() {
        const builder = PaymentInitiation.getBuilder();
        const xml = {
            '?xml': {
                '@version': '1.0',
                '@encoding': 'UTF-8'
            },
            Document: {
                '@xmlns': 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03',
                CstmrCdtTrfInitn: {
                    GrpHdr: {
                        MsgId: this.messageId,
                        CreDtTm: this.creationDate.toISOString(),
                        NbOfTxs: this.paymentInstructions.length.toString(),
                        InitgPty: {
                            Nm: this.initiatingParty.name,
                            Id: {
                                OrgId: {
                                    Othr: {
                                        Id: this.initiatingParty.id,
                                    },
                                },
                            },
                        },
                    },
                    PmtInf: {
                        PmtInfId: this.paymentInformationId,
                        PmtMtd: 'TRF',
                        BtchBookg: 'false',
                        PmtTpInf: {
                            InstrPrty: 'NORM',
                            SvcLvl: {
                                Cd: 'URGP',
                            },
                        },
                        ReqdExctnDt: this.creationDate.toISOString().split('T')[0], // TODO: Check time zone eventually
                        Dbtr: this.party(this.initiatingParty),
                        DbtrAcct: this.account(this.initiatingParty.account),
                        DbtrAgt: this.agent(this.initiatingParty.agent),
                        ChrgBr: 'SHAR',
                        CdtTrfTxInf: this.paymentInstructions.map(p => this.creditTransfer(p)),
                    },
                },
            },
        };
        return builder.build(xml);
    }
}

/**
 * Represents a SEPA Credit Payment Initiation.
 * This class handles the creation and serialization of SEPA credit transfer messages
 * according to the ISO20022 standard.
 * @class
 * @extends PaymentInitiation
 * @param {SEPACreditPaymentInitiationConfig} config - The configuration for the SEPA Credit Payment Initiation message.
 * @example
 * ```typescript
 * // Creating a SEPA payment message
 * const payment = new SEPACreditPaymentInitiation({
 *   // configuration options
 * });
 * // Uploading the payment
 * client.paymentTransfers.create(payment);
 * // Parsing from XML
 * const xml = '<xml>...</xml>';
 * const parsedTransfer = SEPACreditPaymentInitiation.fromXML(xml);
 * ```
 * @see {@link https://docs.iso20022js.com/pain/sepacredit} for more information.
 */
class SEPACreditPaymentInitiation extends PaymentInitiation {
    initiatingParty;
    messageId;
    creationDate;
    paymentInstructions;
    paymentInformationId;
    categoryPurpose;
    formattedPaymentSum;
    /**
     * Creates an instance of SEPACreditPaymentInitiation.
     * @param {SEPACreditPaymentInitiationConfig} config - The configuration object for the SEPA credit transfer.
     */
    constructor(config) {
        super({ type: "sepa" });
        this.initiatingParty = config.initiatingParty;
        this.paymentInstructions = config.paymentInstructions;
        this.messageId = config.messageId || v4().replace(/-/g, '');
        this.creationDate = config.creationDate || new Date();
        this.formattedPaymentSum = this.sumPaymentInstructions(this.paymentInstructions);
        this.paymentInformationId = sanitize(v4(), 35);
        this.categoryPurpose = config.categoryPurpose;
        this.validate();
    }
    // NOTE: Does not work with different currencies. In the meantime we will use a guard.
    // TODO: Figure out what to do with different currencies
    /**
     * Calculates the sum of all payment instructions.
     * @private
     * @param {AtLeastOne<SEPACreditPaymentInstruction>} instructions - Array of payment instructions.
     * @returns {string} The total sum formatted as a string with 2 decimal places.
     * @throws {Error} If payment instructions have different currencies.
     */
    sumPaymentInstructions(instructions) {
        this.validateAllInstructionsHaveSameCurrency();
        const instructionDineros = instructions.map(instruction => Dinero({ amount: instruction.amount, currency: instruction.currency }));
        return instructionDineros.reduce((acc, next) => {
            return acc.add(next);
        }, Dinero({ amount: 0, currency: instructions[0].currency })).toFormat('0.00');
    }
    /**
     * Validates the payment initiation data according to SEPA requirements.
     * @private
     * @throws {Error} If messageId exceeds 35 characters.
     * @throws {Error} If payment instructions have different currencies.
     * @throws {Error} If any creditor has incomplete address information.
     */
    validate() {
        if (this.messageId.length > 35) {
            throw new Error('messageId must not exceed 35 characters');
        }
        this.validateAllInstructionsHaveSameCurrency();
    }
    // Validates that all payment instructions have the same currency
    // TODO: Remove this when we figure out how to run sumPaymentInstructions safely
    validateAllInstructionsHaveSameCurrency() {
        if (!this.paymentInstructions.every((i) => { return i.currency === this.paymentInstructions[0].currency; })) {
            throw new Error("In order to calculate the payment instructions sum, all payment instruction currencies must be the same.");
        }
    }
    /**
     * Generates payment information for a single SEPA credit transfer instruction.
     * @param {SEPACreditPaymentInstruction} instruction - The payment instruction.
     * @returns {Object} The payment information object formatted according to SEPA specifications.
     */
    creditTransfer(instruction) {
        const paymentInstructionId = sanitize(instruction.id || v4(), 35);
        const endToEndId = sanitize(instruction.endToEndId || instruction.id || v4(), 35);
        const dinero = Dinero({ amount: instruction.amount, currency: instruction.currency });
        return {
            PmtId: {
                InstrId: paymentInstructionId,
                EndToEndId: endToEndId,
            },
            Amt: {
                InstdAmt: {
                    '#': dinero.toFormat('0.00'),
                    '@Ccy': instruction.currency,
                },
            },
            ...(instruction.creditor.agent && { CdtrAgt: this.agent(instruction.creditor.agent) }),
            Cdtr: this.party(instruction.creditor),
            CdtrAcct: {
                Id: { IBAN: instruction.creditor.account.iban },
                Ccy: instruction.currency,
            },
            RmtInf: instruction.remittanceInformation ? {
                Ustrd: instruction.remittanceInformation,
            } : undefined,
        };
    }
    /**
     * Serializes the SEPA credit transfer initiation to an XML string.
     * @returns {string} The XML representation of the SEPA credit transfer initiation.
     */
    serialize() {
        const builder = PaymentInitiation.getBuilder();
        const xml = {
            '?xml': {
                '@version': '1.0',
                '@encoding': 'UTF-8'
            },
            Document: {
                '@xmlns': 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03',
                '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                CstmrCdtTrfInitn: {
                    GrpHdr: {
                        MsgId: this.messageId,
                        CreDtTm: this.creationDate.toISOString(),
                        NbOfTxs: this.paymentInstructions.length.toString(),
                        CtrlSum: this.formattedPaymentSum,
                        InitgPty: {
                            Nm: this.initiatingParty.name,
                            Id: {
                                OrgId: {
                                    Othr: {
                                        Id: this.initiatingParty.id,
                                    },
                                },
                            },
                        },
                    },
                    PmtInf: {
                        PmtInfId: this.paymentInformationId,
                        PmtMtd: 'TRF',
                        NbOfTxs: this.paymentInstructions.length.toString(),
                        CtrlSum: this.formattedPaymentSum,
                        PmtTpInf: {
                            SvcLvl: { Cd: 'SEPA' },
                            ...(this.categoryPurpose && {
                                CtgyPurp: { Cd: this.categoryPurpose }
                            }),
                        },
                        ReqdExctnDt: this.creationDate.toISOString().split('T').at(0),
                        Dbtr: this.party(this.initiatingParty),
                        DbtrAcct: this.account(this.initiatingParty.account),
                        DbtrAgt: this.agent(this.initiatingParty.agent),
                        ChrgBr: 'SLEV',
                        // payments[]
                        CdtTrfTxInf: this.paymentInstructions.map(p => this.creditTransfer(p)),
                    }
                }
            },
        };
        return builder.build(xml);
    }
    static fromXML(rawXml) {
        const parser = new fxp.XMLParser({ ignoreAttributes: false });
        const xml = parser.parse(rawXml);
        if (!xml.Document) {
            throw new InvalidXmlError("Invalid XML format");
        }
        const namespace = (xml.Document['@_xmlns'] || xml.Document['@_Xmlns']);
        if (!namespace.startsWith('urn:iso:std:iso:20022:tech:xsd:pain.001.001.03')) {
            throw new InvalidXmlNamespaceError('Invalid PAIN.001 namespace');
        }
        const messageId = xml.Document.CstmrCdtTrfInitn.GrpHdr.MsgId;
        const creationDate = new Date(xml.Document.CstmrCdtTrfInitn.GrpHdr.CreDtTm);
        if (Array.isArray(xml.Document.CstmrCdtTrfInitn.PmtInf)) {
            throw new Error('Multiple PmtInf is not supported');
        }
        // Assuming we have one PmtInf / one Debtor, we can hack together this information from InitgPty / Dbtr
        const initiatingParty = {
            name: xml.Document.CstmrCdtTrfInitn.GrpHdr.InitgPty.Nm || xml.Document.CstmrCdtTrfInitn.PmtInf.Dbtr.Nm,
            id: xml.Document.CstmrCdtTrfInitn.GrpHdr.InitgPty.Id.OrgId.Othr.Id,
            agent: parseAgent(xml.Document.CstmrCdtTrfInitn.PmtInf.DbtrAgt),
            account: parseAccount(xml.Document.CstmrCdtTrfInitn.PmtInf.DbtrAcct)
        };
        const rawInstructions = Array.isArray(xml.Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf) ? xml.Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf : [xml.Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf];
        const paymentInstructions = rawInstructions.map((inst) => {
            const currency = inst.Amt.InstdAmt['@_Ccy'];
            const amount = parseAmountToMinorUnits(Number(inst.Amt.InstdAmt['#text']), currency);
            const rawPostalAddress = inst.Cdtr.PstlAdr;
            return {
                ...(inst.PmtId.InstrId && { id: inst.PmtId.InstrId.toString() }),
                ...(inst.PmtId.EndToEndId && { endToEndId: inst.PmtId.EndToEndId.toString() }),
                type: 'sepa',
                direction: 'credit',
                amount: amount,
                currency: currency,
                creditor: {
                    name: inst.Cdtr?.Nm,
                    agent: parseAgent(inst.CdtrAgt),
                    account: parseAccount(inst.CdtrAcct),
                    ...((rawPostalAddress && (rawPostalAddress.StreetName || rawPostalAddress.BldgNb || rawPostalAddress.PstlCd || rawPostalAddress.TwnNm || rawPostalAddress.Ctry)) ? {
                        address: {
                            ...(rawPostalAddress.StrtNm && { streetName: rawPostalAddress.StrtNm.toString() }),
                            ...(rawPostalAddress.BldgNb && { buildingNumber: rawPostalAddress.BldgNb.toString() }),
                            ...(rawPostalAddress.TwnNm && { townName: rawPostalAddress.TwnNm.toString() }),
                            ...(rawPostalAddress.CtrySubDvsn && { countrySubDivision: rawPostalAddress.CtrySubDvsn.toString() }),
                            ...(rawPostalAddress.PstCd && { postalCode: rawPostalAddress.PstCd.toString() }),
                            ...(rawPostalAddress.Ctry && { country: rawPostalAddress.Ctry }),
                        }
                    } : {}),
                },
                ...(inst.RmtInf?.Ustrd && { remittanceInformation: inst.RmtInf.Ustrd.toString() })
            };
        });
        return new SEPACreditPaymentInitiation({
            messageId: messageId,
            creationDate: creationDate,
            initiatingParty: initiatingParty,
            paymentInstructions: paymentInstructions
        });
    }
}

/**
 * Represents a RTP Credit Payment Initiation.
 * This class handles the creation and serialization of RTP credit transfer messages
 * according to the ISO20022 standard.
 * @class
 * @extends PaymentInitiation
 * @param {RTPCreditPaymentInitiationConfig} config - The configuration for the RTP Credit Payment Initiation message.
 * @example
 * ```typescript
 * // Creating a payment message
 * const payment = new RTPCreditPaymentInitiation({
 *   ...
 * });
 * // Uploading to fiatwebservices.com
 * client.paymentTransfers.create(payment);
 * // Parsing from XML
 * const xml = '<xml>...</xml>';
 * const parsedTransfer = RTPCreditPaymentInitiation.fromXML(xml);
 * ```
 * @see {@link https://docs.iso20022js.com/pain/rtpcredit} for more information.
 */
class RTPCreditPaymentInitiation extends PaymentInitiation {
    initiatingParty;
    paymentInstructions;
    messageId;
    creationDate;
    paymentInformationId;
    formattedPaymentSum;
    constructor(config) {
        super({ type: "rtp" });
        this.initiatingParty = config.initiatingParty;
        this.paymentInstructions = config.paymentInstructions;
        this.messageId = config.messageId || v4().replace(/-/g, '');
        this.creationDate = config.creationDate || new Date();
        this.paymentInformationId = sanitize(v4(), 35);
        this.formattedPaymentSum = this.sumPaymentInstructions(this.paymentInstructions);
        this.validate();
    }
    /**
     * Calculates the sum of all payment instructions.
     * @private
     * @param {AtLeastOne<RTPCreditPaymentInstruction>} instructions - Array of payment instructions.
     * @returns {string} The total sum formatted as a string with 2 decimal places.
     * @throws {Error} If payment instructions have different currencies.
     */
    sumPaymentInstructions(instructions) {
        const instructionDineros = instructions.map(instruction => Dinero({ amount: instruction.amount, currency: instruction.currency }));
        return instructionDineros.reduce((acc, next) => {
            return acc.add(next);
        }, Dinero({ amount: 0, currency: instructions[0].currency })).toFormat('0.00');
    }
    /**
     * Validates the payment initiation data according to SEPA requirements.
     * @private
     * @throws {Error} If messageId exceeds 35 characters.
     * @throws {Error} If payment instructions have different currencies.
     * @throws {Error} If any creditor has incomplete address information.
     */
    validate() {
        if (this.messageId.length > 35) {
            throw new Error('messageId must not exceed 35 characters');
        }
    }
    /**
     * Generates payment information for a single SEPA credit transfer instruction.
     * @param {RTPCreditPaymentInstruction} instruction - The payment instruction.
     * @returns {Object} The payment information object formatted according to SEPA specifications.
     */
    creditTransfer(instruction) {
        const paymentInstructionId = sanitize(instruction.id || v4(), 35);
        const endToEndId = sanitize(instruction.endToEndId || instruction.id || v4(), 35);
        const dinero = Dinero({ amount: instruction.amount, currency: instruction.currency });
        return {
            PmtId: {
                InstrId: paymentInstructionId,
                EndToEndId: endToEndId,
            },
            Amt: {
                InstdAmt: {
                    '#': dinero.toFormat('0.00'),
                    '@Ccy': instruction.currency,
                },
            },
            CdtrAgt: this.agent(instruction.creditor.agent),
            Cdtr: this.party(instruction.creditor),
            CdtrAcct: {
                Id: {
                    Othr: {
                        Id: instruction.creditor.account.accountNumber,
                    },
                },
            },
            RmtInf: instruction.remittanceInformation ? {
                Ustrd: instruction.remittanceInformation,
            } : undefined,
        };
    }
    /**
     * Serializes the RTP credit transfer initiation to an XML string.
     * @returns {string} The XML representation of the RTP credit transfer initiation.
     */
    serialize() {
        const builder = PaymentInitiation.getBuilder();
        const xml = {
            '?xml': {
                '@version': '1.0',
                '@encoding': 'UTF-8'
            },
            Document: {
                '@xmlns': 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03',
                '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                CstmrCdtTrfInitn: {
                    GrpHdr: {
                        MsgId: this.messageId,
                        CreDtTm: this.creationDate.toISOString(),
                        NbOfTxs: this.paymentInstructions.length.toString(),
                        CtrlSum: this.formattedPaymentSum,
                        InitgPty: {
                            Nm: this.initiatingParty.name,
                            Id: {
                                OrgId: {
                                    Othr: {
                                        Id: this.initiatingParty.id,
                                    },
                                },
                            },
                        },
                    },
                    PmtInf: {
                        PmtInfId: this.paymentInformationId,
                        PmtMtd: 'TRF',
                        NbOfTxs: this.paymentInstructions.length.toString(),
                        CtrlSum: this.formattedPaymentSum,
                        PmtTpInf: {
                            SvcLvl: { Cd: 'URNS' },
                            LclInstrm: { Prtry: "RTP" },
                        },
                        ReqdExctnDt: this.creationDate.toISOString().split('T').at(0),
                        Dbtr: this.party(this.initiatingParty),
                        DbtrAcct: this.account(this.initiatingParty.account),
                        DbtrAgt: this.agent(this.initiatingParty.agent),
                        ChrgBr: 'SLEV',
                        // payments[]
                        CdtTrfTxInf: this.paymentInstructions.map(p => this.creditTransfer(p)),
                    }
                }
            },
        };
        return builder.build(xml);
    }
    static fromXML(rawXml) {
        const parser = new fxp.XMLParser({ ignoreAttributes: false });
        const xml = parser.parse(rawXml);
        if (!xml.Document) {
            throw new InvalidXmlError("Invalid XML format");
        }
        const namespace = (xml.Document['@_xmlns'] || xml.Document['@_Xmlns']);
        if (!namespace.startsWith('urn:iso:std:iso:20022:tech:xsd:pain.001.001.03')) {
            throw new InvalidXmlNamespaceError('Invalid PAIN.001 namespace');
        }
        const messageId = xml.Document.CstmrCdtTrfInitn.GrpHdr.MsgId;
        const creationDate = new Date(xml.Document.CstmrCdtTrfInitn.GrpHdr.CreDtTm);
        if (Array.isArray(xml.Document.CstmrCdtTrfInitn.PmtInf)) {
            throw new Error('Multiple PmtInf is not supported');
        }
        // Assuming we have one PmtInf / one Debtor, we can hack together this information from InitgPty / Dbtr
        const initiatingParty = {
            name: xml.Document.CstmrCdtTrfInitn.GrpHdr.InitgPty.Nm || xml.Document.CstmrCdtTrfInitn.PmtInf.Dbtr.Nm,
            id: (xml.Document.CstmrCdtTrfInitn.GrpHdr.InitgPty.Id.OrgId?.Othr?.Id) || (xml.Document.CstmrCdtTrfInitn.GrpHdr.InitgPty.Id.OrgId?.BICOrBEI),
            agent: parseAgent(xml.Document.CstmrCdtTrfInitn.PmtInf.DbtrAgt),
            account: parseAccount(xml.Document.CstmrCdtTrfInitn.PmtInf.DbtrAcct)
        };
        const rawInstructions = Array.isArray(xml.Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf) ? xml.Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf : [xml.Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf];
        const paymentInstructions = rawInstructions.map((inst) => {
            const currency = inst.Amt.InstdAmt['@_Ccy'];
            const amount = parseAmountToMinorUnits(Number(inst.Amt.InstdAmt['#text']), currency);
            const rawPostalAddress = inst.Cdtr.PstlAdr;
            return {
                ...(inst.PmtId.InstrId && { id: inst.PmtId.InstrId.toString() }),
                ...(inst.PmtId.EndToEndId && { endToEndId: inst.PmtId.EndToEndId.toString() }),
                type: 'sepa',
                direction: 'credit',
                amount: amount,
                currency: currency,
                creditor: {
                    name: inst.Cdtr?.Nm,
                    agent: parseAgent(inst.CdtrAgt),
                    account: parseAccount(inst.CdtrAcct),
                    ...((rawPostalAddress && (rawPostalAddress.StreetName || rawPostalAddress.BldgNb || rawPostalAddress.PstlCd || rawPostalAddress.TwnNm || rawPostalAddress.Ctry)) ? {
                        address: {
                            ...(rawPostalAddress.StrtNm && { streetName: rawPostalAddress.StrtNm.toString() }),
                            ...(rawPostalAddress.BldgNb && { buildingNumber: rawPostalAddress.BldgNb.toString() }),
                            ...(rawPostalAddress.TwnNm && { townName: rawPostalAddress.TwnNm.toString() }),
                            ...(rawPostalAddress.CtrySubDvsn && { countrySubDivision: rawPostalAddress.CtrySubDvsn.toString() }),
                            ...(rawPostalAddress.PstCd && { postalCode: rawPostalAddress.PstCd.toString() }),
                            ...(rawPostalAddress.Ctry && { country: rawPostalAddress.Ctry }),
                        }
                    } : {}),
                },
                ...(inst.RmtInf?.Ustrd && { remittanceInformation: inst.RmtInf.Ustrd.toString() })
            };
        });
        return new RTPCreditPaymentInitiation({
            messageId: messageId,
            creationDate: creationDate,
            initiatingParty: initiatingParty,
            paymentInstructions: paymentInstructions
        });
    }
}

/*
 * Represents a SEPA credit payment instruction, extending the base PaymentInstruction.
 */
/**
 * Category purpose codes as defined in ISO 20022 ExternalCategoryPurpose1Code.
 * @see {@link https://www.iso20022.org/catalogue-messages/additional-content-messages/external-code-sets}
 */
/**
 * ACH Local Instrument Codes as defined in NACHA standards.
 * These codes identify the specific type of ACH transaction.
 */
const ACHLocalInstrumentCode = {
    /** Corporate Credit or Debit */
    CorporateCreditDebit: 'CCD',
    /** Prearranged Payment and Deposit */
    PrearrangedPaymentDeposit: 'PPD',
    /** Internet-Initiated Entry */
    InternetInitiated: 'WEB',
    /** Telephone-Initiated Entry */
    TelephoneInitiated: 'TEL',
    /** Point-of-Purchase Entry */
    PointOfPurchase: 'POP',
    /** Accounts Receivable Entry */
    AccountsReceivable: 'ARC',
    /** Back Office Conversion */
    BackOfficeConversion: 'BOC',
    /** Represented Check Entry */
    RepresentedCheck: 'RCK',
};
const ACHLocalInstrumentCodeDescriptionMap = {
    'CCD': 'Corporate Credit or Debit',
    'PPD': 'Prearranged Payment and Deposit',
    'WEB': 'Internet-Initiated Entry',
    'TEL': 'Telephone-Initiated Entry',
    'POP': 'Point-of-Purchase Entry',
    'ARC': 'Accounts Receivable Entry',
    'BOC': 'Back Office Conversion',
    'RCK': 'Represented Check Entry',
};

/**
 * Represents an ACH Credit Payment Initiation.
 * This class handles the creation and serialization of ACH credit transfer messages
 * according to the ISO20022 standard.
 * @class
 * @extends PaymentInitiation
 * @param {ACHCreditPaymentInitiationConfig} config - The configuration for the ACH Credit Payment Initiation message.
 * @example
 * ```typescript
 * // Creating a payment message
 * const payment = new ACHCreditPaymentInitiation({
 *   initiatingParty: {
 *     name: 'John Doe Corporation',
 *     id: 'JOHNDOE99',
 *     account: {
 *       accountNumber: '0123456789'
 *     },
 *     agent: {
 *       abaRoutingNumber: '123456789',
 *     }
 *   },
 *   paymentInstructions: [{
 *     type: 'ach',
 *     direction: 'credit',
 *     amount: 1000,
 *     currency: 'USD',
 *     creditor: {
 *       name: 'John Doe Funding LLC',
 *       account: {
 *         accountNumber: '0123456789'
 *       },
 *       agent: {
 *         abaRoutingNumber: '0123456789'
 *       }
 *     }
 *   }]
 * });
 *
 * // Serializing to XML
 * const xml = payment.serialize();
 *
 * // Parsing from XML
 * const parsedPayment = ACHCreditPaymentInitiation.fromXML(xml);
 * ```
 */
class ACHCreditPaymentInitiation extends PaymentInitiation {
    initiatingParty;
    paymentInstructions;
    messageId;
    creationDate;
    paymentInformationId;
    localInstrument;
    serviceLevel;
    instructionPriority;
    formattedPaymentSum;
    constructor(config) {
        super({ type: "ach" });
        this.initiatingParty = config.initiatingParty;
        this.paymentInstructions = config.paymentInstructions;
        this.messageId = config.messageId || v4().replace(/-/g, '');
        this.creationDate = config.creationDate || new Date();
        this.paymentInformationId = sanitize(v4(), 35);
        this.localInstrument = config.localInstrument || ACHLocalInstrumentCode.CorporateCreditDebit;
        this.serviceLevel = 'NURG'; // Normal Urgency
        this.instructionPriority = 'NORM'; // Normal Priority
        this.formattedPaymentSum = this.sumPaymentInstructions(this.paymentInstructions);
        this.validate();
    }
    /**
     * Calculates the sum of all payment instructions.
     * @private
     * @param {AtLeastOne<ACHCreditPaymentInstruction>} instructions - Array of payment instructions.
     * @returns {string} The total sum formatted as a string with 2 decimal places.
     * @throws {Error} If payment instructions have different currencies.
     */
    sumPaymentInstructions(instructions) {
        const instructionDineros = instructions.map(instruction => Dinero({ amount: instruction.amount, currency: instruction.currency }));
        return instructionDineros.reduce((acc, next) => {
            return acc.add(next);
        }, Dinero({ amount: 0, currency: instructions[0].currency })).toFormat('0.00');
    }
    /**
     * Validates the payment initiation data according to ACH requirements.
     * @private
     * @throws {Error} If messageId exceeds 35 characters.
     * @throws {Error} If payment instructions have different currencies.
     * @throws {Error} If any creditor has incomplete information.
     */
    validate() {
        if (this.messageId.length > 35) {
            throw new Error('messageId must not exceed 35 characters');
        }
        // Ensure all payment instructions have USD as currency
        for (const instruction of this.paymentInstructions) {
            if (instruction.currency !== 'USD') {
                throw new Error('ACH payments must use USD as currency');
            }
        }
    }
    /**
     * Generates payment information for a single ACH credit transfer instruction.
     * @param {ACHCreditPaymentInstruction} instruction - The payment instruction.
     * @returns {Object} The payment information object formatted according to ACH specifications.
     */
    creditTransfer(instruction) {
        const paymentInstructionId = sanitize(instruction.id || v4(), 35);
        const endToEndId = sanitize(instruction.endToEndId || instruction.id || v4(), 35);
        const dinero = Dinero({ amount: instruction.amount, currency: instruction.currency });
        return {
            PmtId: {
                InstrId: paymentInstructionId,
                EndToEndId: endToEndId,
            },
            Amt: {
                InstdAmt: {
                    '#': dinero.toFormat('0.00'),
                    '@Ccy': instruction.currency,
                },
            },
            CdtrAgt: this.agent(instruction.creditor.agent),
            Cdtr: this.party(instruction.creditor),
            CdtrAcct: {
                Id: {
                    Othr: {
                        Id: instruction.creditor.account.accountNumber,
                    },
                },
                Tp: {
                    Cd: 'CACC',
                },
                Ccy: instruction.currency,
            },
            RmtInf: instruction.remittanceInformation ? {
                Ustrd: instruction.remittanceInformation,
            } : undefined,
        };
    }
    /**
     * Serializes the ACH credit transfer initiation to an XML string.
     * @returns {string} The XML representation of the ACH credit transfer initiation.
     */
    serialize() {
        const builder = PaymentInitiation.getBuilder();
        const xml = {
            '?xml': {
                '@version': '1.0',
                '@encoding': 'UTF-8'
            },
            Document: {
                '@xmlns': 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03',
                '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                CstmrCdtTrfInitn: {
                    GrpHdr: {
                        MsgId: this.messageId,
                        CreDtTm: this.creationDate.toISOString(),
                        NbOfTxs: this.paymentInstructions.length.toString(),
                        CtrlSum: this.formattedPaymentSum,
                        InitgPty: {
                            Nm: this.initiatingParty.name,
                            Id: {
                                OrgId: {
                                    BICOrBEI: this.initiatingParty.id,
                                },
                            },
                        },
                    },
                    PmtInf: {
                        PmtInfId: this.paymentInformationId,
                        PmtMtd: 'TRF',
                        BtchBookg: false,
                        NbOfTxs: this.paymentInstructions.length.toString(),
                        CtrlSum: this.formattedPaymentSum,
                        PmtTpInf: {
                            InstrPrty: this.instructionPriority,
                            SvcLvl: { Cd: this.serviceLevel },
                            LclInstrm: { Prtry: this.localInstrument },
                        },
                        ReqdExctnDt: this.creationDate.toISOString().split('T')[0],
                        Dbtr: this.party(this.initiatingParty),
                        DbtrAcct: this.account(this.initiatingParty.account),
                        DbtrAgt: this.agent(this.initiatingParty.agent),
                        ChrgBr: 'SHAR',
                        // payments[]
                        CdtTrfTxInf: this.paymentInstructions.map(p => this.creditTransfer(p)),
                    }
                }
            },
        };
        return builder.build(xml);
    }
    /**
     * Creates an ACHCreditPaymentInitiation instance from an XML string.
     * @param {string} rawXml - The XML string to parse.
     * @returns {ACHCreditPaymentInitiation} A new ACHCreditPaymentInitiation instance.
     * @throws {InvalidXmlError} If the XML format is invalid.
     * @throws {InvalidXmlNamespaceError} If the XML namespace is invalid.
     * @throws {Error} If multiple payment information blocks are found.
     */
    static fromXML(rawXml) {
        const parser = new fxp.XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
        const xml = parser.parse(rawXml);
        if (!xml.Document) {
            throw new InvalidXmlError("Invalid XML format");
        }
        const namespace = (xml.Document['@_xmlns'] || xml.Document['@_Xmlns']);
        if (!namespace.startsWith('urn:iso:std:iso:20022:tech:xsd:pain.001.001.03')) {
            throw new InvalidXmlNamespaceError('Invalid PAIN.001 namespace');
        }
        const messageId = xml.Document.CstmrCdtTrfInitn.GrpHdr.MsgId;
        const creationDate = new Date(xml.Document.CstmrCdtTrfInitn.GrpHdr.CreDtTm);
        if (Array.isArray(xml.Document.CstmrCdtTrfInitn.PmtInf)) {
            throw new Error('Multiple PmtInf is not supported');
        }
        // Extract payment type information
        xml.Document.CstmrCdtTrfInitn.PmtInf.PmtTpInf;
        // Assuming we have one PmtInf / one Debtor, we can hack together this information from InitgPty / Dbtr
        const initiatingParty = {
            name: xml.Document.CstmrCdtTrfInitn.GrpHdr.InitgPty.Nm || xml.Document.CstmrCdtTrfInitn.PmtInf.Dbtr.Nm,
            id: (xml.Document.CstmrCdtTrfInitn.GrpHdr.InitgPty.Id.OrgId?.BICOrBEI) || (xml.Document.CstmrCdtTrfInitn.GrpHdr.InitgPty.Id.OrgId?.Othr?.Id),
            agent: parseAgent(xml.Document.CstmrCdtTrfInitn.PmtInf.DbtrAgt),
            account: parseAccount(xml.Document.CstmrCdtTrfInitn.PmtInf.DbtrAcct)
        };
        const rawInstructions = Array.isArray(xml.Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf) ? xml.Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf : [xml.Document.CstmrCdtTrfInitn.PmtInf.CdtTrfTxInf];
        const paymentInstructions = rawInstructions.map((inst) => {
            const currency = inst.Amt.InstdAmt['@_Ccy'];
            const amount = parseAmountToMinorUnits(Number(inst.Amt.InstdAmt['#text']), currency);
            const rawPostalAddress = inst.Cdtr.PstlAdr;
            return {
                ...(inst.PmtId.InstrId && { id: inst.PmtId.InstrId.toString() }),
                ...(inst.PmtId.EndToEndId && { endToEndId: inst.PmtId.EndToEndId.toString() }),
                type: 'ach',
                direction: 'credit',
                amount: amount,
                currency: currency,
                creditor: {
                    name: inst.Cdtr?.Nm,
                    agent: parseAgent(inst.CdtrAgt),
                    account: parseAccount(inst.CdtrAcct),
                    ...((rawPostalAddress && (rawPostalAddress.StrtNm || rawPostalAddress.BldgNb || rawPostalAddress.PstCd || rawPostalAddress.TwnNm || rawPostalAddress.Ctry)) ? {
                        address: {
                            ...(rawPostalAddress.StrtNm && { streetName: rawPostalAddress.StrtNm.toString() }),
                            ...(rawPostalAddress.BldgNb && { buildingNumber: rawPostalAddress.BldgNb.toString() }),
                            ...(rawPostalAddress.TwnNm && { townName: rawPostalAddress.TwnNm.toString() }),
                            ...(rawPostalAddress.CtrySubDvsn && { countrySubDivision: rawPostalAddress.CtrySubDvsn.toString() }),
                            ...(rawPostalAddress.PstCd && { postalCode: rawPostalAddress.PstCd.toString() }),
                            ...(rawPostalAddress.Ctry && { country: rawPostalAddress.Ctry }),
                        }
                    } : {}),
                },
                ...(inst.RmtInf?.Ustrd && { remittanceInformation: inst.RmtInf.Ustrd.toString() })
            };
        });
        return new ACHCreditPaymentInitiation({
            messageId: messageId,
            creationDate: creationDate,
            initiatingParty: initiatingParty,
            paymentInstructions: paymentInstructions
        });
    }
}

const ISO20022Messages = {
    CAMT_003: "CAMT.003",
    CAMT_004: "CAMT.004",
    CAMT_005: "CAMT.005",
    CAMT_006: "CAMT.006",
    CAMT_053: "CAMT.053",
    PAIN_001: "PAIN.001",
    PAIN_002: "PAIN.002",
};
const ISO20022Implementations = new Map();
function registerISO20022Implementation(cl) {
    cl.supportedMessages().forEach((msg) => {
        ISO20022Implementations.set(msg, cl);
    });
}
function getISO20022Implementation(type) {
    return ISO20022Implementations.get(type);
}
class XML {
    /**
     * Creates and configures the XML Parser
     *
     * @returns {XMLParser} A configured instance of XMLParser
     */
    static getParser() {
        return new fxp.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            tagValueProcessor: (tagName, tagValue, _jPath, _hasAttributes, isLeafNode) => {
                /**
                 * Codes and Entry References can look like numbers and get parsed
                 * appropriately. We don't want this to happen, as they contain leading
                 * zeros or are too long and overflow.
                 *
                 * Ex. <Cd>0001234<Cd> Should resolve to "0001234"
                 */
                if (isLeafNode && ['Cd', 'NtryRef'].includes(tagName))
                    return undefined;
                return tagValue;
            },
        });
    }
    static getBuilder() {
        return new fxp.XMLBuilder({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            format: true,
        });
    }
}

class CashManagementGetAccount {
    _data;
    constructor(data) {
        this._data = data;
    }
    get data() {
        return this._data;
    }
    static supportedMessages() {
        return [ISO20022Messages.CAMT_003];
    }
    static fromDocumentOject(doc) {
        const rawHeader = doc.Document?.GetAcct?.MsgHdr;
        if (!rawHeader) {
            throw new InvalidStructureError("Invalid CAMT.003 document: missing MsgHdr");
        }
        const header = parseMessageHeader(rawHeader);
        const newCrit = doc.Document?.GetAcct?.AcctQryDef?.AcctCrit?.NewCrit;
        if (!newCrit) {
            throw new InvalidStructureError("Invalid CAMT.003 document: missing GetAcct.AcctQryDef.AcctCrit.NewCrit");
        }
        const name = newCrit.NewQryNm;
        let searchCriteria = [];
        let rawCriterias = newCrit.SchCrit;
        if (!Array.isArray(rawCriterias)) {
            rawCriterias = [rawCriterias];
        }
        rawCriterias = rawCriterias.filter((c) => !!c);
        if (rawCriterias.length === 0) {
            throw new InvalidStructureError("Invalid CAMT.003 document: missing search criteria");
        }
        for (const rawCriterium of rawCriterias) {
            const crit = {};
            // search on Ids, only one criterium supported for now
            if (rawCriterium.AcctId) {
                if (Array.isArray(rawCriterium.AcctId) && rawCriterium.AcctId.length > 1) {
                    throw new InvalidStructureError("Invalid CAMT.003 document: multiple AcctId criterium not supported");
                }
                const acctId = Array.isArray(rawCriterium.AcctId) ? rawCriterium.AcctId[0] : rawCriterium.AcctId;
                if (acctId.CTTxt) {
                    crit.accountRegExp = `.*${acctId.CTTxt}.*`; // contains
                }
                else if (acctId.NCTTxt) {
                    crit.accountRegExp = `^((?!${acctId.NCTTxt}).)*$`; // does not contain
                }
                else if (acctId.EQ) {
                    crit.accountEqualTo = parseAccountIdentification(acctId.EQ);
                }
            }
            // search on currency
            if (rawCriterium.Ccy) {
                if (Array.isArray(rawCriterium.Ccy) && rawCriterium.Ccy.length > 1) {
                    throw new InvalidStructureError("Invalid CAMT.003 document: multiple Ccy criterium not supported");
                }
                const ccy = Array.isArray(rawCriterium.Ccy) ? rawCriterium.Ccy[0] : rawCriterium.Ccy;
                crit.currencyEqualTo = ccy;
            }
            // search on balance as of date
            if (rawCriterium.Bal) {
                if (Array.isArray(rawCriterium.Bal) && rawCriterium.Bal.length > 1) {
                    throw new InvalidStructureError("Invalid CAMT.003 document: multiple Bal criterium not supported");
                }
                const bal = Array.isArray(rawCriterium.Bal) ? rawCriterium.Bal[0] : rawCriterium.Bal;
                if (bal?.ValDt && Array.isArray(bal.ValDt) && bal.ValDt.length > 1) {
                    throw new InvalidStructureError("Invalid CAMT.003 document: multiple ValDt criterium not supported");
                }
                const valDt = Array.isArray(bal?.ValDt) ? bal.ValDt[0] : bal?.ValDt;
                if (valDt?.Dt?.EQDt) {
                    crit.balanceAsOfDateEqualTo = parseDate(valDt.Dt.EQDt);
                }
            }
            searchCriteria.push(crit);
        }
        return new CashManagementGetAccount({
            header,
            newCriteria: {
                name,
                searchCriteria,
            },
        });
    }
    static fromXML(xml) {
        const parser = XML.getParser();
        const doc = parser.parse(xml);
        if (!doc.Document) {
            throw new Error("Invalid XML format");
        }
        const namespace = (doc.Document['@_xmlns'] || doc.Document['@_Xmlns']);
        if (!namespace.startsWith('urn:iso:std:iso:20022:tech:xsd:camt.003.001.')) {
            throw new InvalidXmlNamespaceError('Invalid CAMT.003 namespace');
        }
        return CashManagementGetAccount.fromDocumentOject(doc);
    }
    static fromJSON(json) {
        const obj = JSON.parse(json);
        if (!obj.Document) {
            throw new Error("Invalid JSON format");
        }
        return CashManagementGetAccount.fromDocumentOject(obj);
    }
    serialize() {
        const builder = XML.getBuilder();
        const obj = this.toJSON();
        obj.Document['@_xmlns'] = 'urn:iso:std:iso:20022:tech:xsd:camt.003.001.02';
        obj.Document['@_xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
        return builder.build(obj);
    }
    toJSON() {
        // we should not have to serialize but we do it for consistency
        const Document = {
            GetAcct: {
                MsgHdr: exportMessageHeader(this._data.header),
                AcctQryDef: {
                    AcctCrit: {
                        NewCrit: {
                            NewQryNm: this._data.newCriteria?.name,
                            SchCrit: this._data.newCriteria?.searchCriteria.map((c) => {
                                const obj = {};
                                if (c.accountRegExp) {
                                    if (c.accountRegExp.startsWith('.*') && c.accountRegExp.endsWith('.*')) {
                                        obj.AcctId = { CTTxt: c.accountRegExp.replace(/^\.\*/, '').replace(/\.\*$/, '') }; // contains
                                    }
                                    else if (c.accountRegExp.startsWith('^((?!') && c.accountRegExp.endsWith(').)*$')) {
                                        obj.AcctId = { NCTTxt: c.accountRegExp.replace(/^\^\(\(\!\(/, '').replace(/\)\.\)\*\$$/, '') }; // does not contain
                                    }
                                }
                                else if (c.accountEqualTo) {
                                    obj.AcctId = {
                                        EQ: exportAccountIdentification(c.accountEqualTo)
                                    };
                                }
                                if (c.currencyEqualTo) {
                                    obj.Ccy = [c.currencyEqualTo];
                                }
                                if (c.balanceAsOfDateEqualTo) {
                                    obj.Bal = [{
                                            ValDt: [{
                                                    Dt: {
                                                        EQDt: c.balanceAsOfDateEqualTo.toISOString().slice(0, 10)
                                                    }
                                                }]
                                        }];
                                }
                                return obj;
                            }),
                        }
                    }
                }
            }
        };
        return { Document };
    }
}
registerISO20022Implementation(CashManagementGetAccount);

const parseStatement = (stmt) => {
    const id = stmt.Id.toString();
    const electronicSequenceNumber = stmt.ElctrncSeqNb;
    const legalSequenceNumber = stmt.LglSeqNb;
    const creationDate = new Date(stmt.CreDtTm);
    let fromDate;
    let toDate;
    if (stmt.FrToDt) {
        fromDate = new Date(stmt.FrToDt.FrDtTm);
        toDate = new Date(stmt.FrToDt.ToDtTm);
    }
    // Txn Summaries
    const numOfEntries = stmt.TxsSummry?.TtlNtries.NbOfNtries;
    const sumOfEntries = stmt.TxsSummry?.TtlNtries.Sum;
    const rawNetAmountOfEntries = stmt.TxsSummry?.TtlNtries.TtlNetNtryAmt;
    let netAmountOfEntries;
    // No currency information, default to USD
    if (rawNetAmountOfEntries) {
        netAmountOfEntries = parseAmountToMinorUnits(rawNetAmountOfEntries);
    }
    const numOfCreditEntries = stmt.TxsSummry?.TtlCdtNtries.NbOfNtries;
    const sumOfCreditEntries = stmt.TxsSummry?.TtlCdtNtries.Sum;
    const numOfDebitEntries = stmt.TxsSummry?.TtlDbtNtries.NbOfNtries;
    const sumOfDebitEntries = stmt.TxsSummry?.TtlDbtNtries.Sum;
    // Get account information
    // TODO: Save account types here
    const account = parseAccount(stmt.Acct);
    const agent = parseAgent(stmt.Acct.Svcr);
    let balances = [];
    if (Array.isArray(stmt.Bal)) {
        balances = stmt.Bal.map(parseBalance);
    }
    else if (stmt.Bal) {
        balances = [parseBalance(stmt.Bal)];
    }
    let entries = [];
    if (Array.isArray(stmt.Ntry)) {
        entries = stmt.Ntry.map(parseEntry);
    }
    else if (stmt.Ntry) {
        entries = [parseEntry(stmt.Ntry)];
    }
    return {
        id,
        electronicSequenceNumber,
        legalSequenceNumber,
        creationDate,
        fromDate,
        toDate,
        account,
        agent,
        numOfEntries,
        sumOfEntries,
        netAmountOfEntries,
        numOfCreditEntries,
        sumOfCreditEntries,
        numOfDebitEntries,
        sumOfDebitEntries,
        balances,
        entries,
    };
};
const exportStatement = (stmt) => {
    const obj = {
        Id: stmt.id,
        ElctrncSeqNb: stmt.electronicSequenceNumber,
        LglSeqNb: stmt.legalSequenceNumber,
        CreDtTm: stmt.creationDate.toISOString(),
        FrToDt: stmt.fromDate && stmt.toDate
            ? {
                FrDtTm: stmt.fromDate.toISOString().slice(0, 10),
                ToDtTm: stmt.toDate.toISOString().slice(0, 10),
            }
            : undefined,
        TxsSummry: {
            TtlNtries: {
                NbOfNtries: stmt.numOfEntries,
                Sum: stmt.sumOfEntries,
                TtlNetNtryAmt: stmt.netAmountOfEntries
                    ? exportAmountToString(stmt.netAmountOfEntries, stmt.balances[0]?.currency)
                    : undefined,
            },
            TtlCdtNtries: {
                NbOfNtries: stmt.numOfCreditEntries,
                Sum: stmt.sumOfCreditEntries,
            },
            TtlDbtNtries: {
                NbOfNtries: stmt.numOfDebitEntries,
                Sum: stmt.sumOfDebitEntries,
            },
        },
        Acct: {
            ...exportAccount(stmt.account),
            Svcr: exportAgent(stmt.agent)
        },
        Bal: stmt.balances.map((bal) => exportBalance(bal)),
        Ntry: stmt.entries.map((entry) => exportEntry(entry)),
    };
    return obj;
};
const parseBalance = (balance) => {
    const rawAmount = balance.Amt['#text'];
    const currency = balance.Amt['@_Ccy'];
    const amount = parseAmountToMinorUnits(rawAmount, currency);
    const creditDebitIndicator = balance.CdtDbtInd === 'CRDT' ? 'credit' : 'debit';
    const type = balance.Tp.CdOrPrtry.Cd;
    const date = parseDate(balance.Dt);
    return {
        date,
        amount,
        currency,
        creditDebitIndicator,
        type,
    };
};
const exportBalance = (balance) => {
    const obj = {
        Amt: {
            '#text': exportAmountToString(balance.amount, balance.currency),
            '@_Ccy': balance.currency,
        },
        CdtDbtInd: balance.creditDebitIndicator === 'credit' ? 'CRDT' : 'DBIT',
        Tp: {
            CdOrPrtry: {
                Cd: balance.type,
            },
        },
        Dt: {
            DtTm: balance.date.toISOString(),
        },
    };
    return obj;
};
const parseBalanceReport = (currency, balance) => {
    const rawAmount = balance.Amt;
    const amount = parseAmountToMinorUnits(rawAmount, currency);
    const creditDebitIndicator = balance.CdtDbtInd === 'CRDT' ? 'credit' : 'debit';
    const type = balance.Tp?.Cd || balance.Tp?.Prtry;
    const valueDate = parseDate(balance.ValDt?.Dt);
    const processingDate = parseDate(balance.PrcgDt?.DtTm);
    return {
        amount,
        creditDebitIndicator,
        type,
        valueDate,
        processingDate,
    };
};
const exportBalanceReport = (currency, balance) => {
    const obj = {
        Amt: exportAmountToString(balance.amount, currency),
        CdtDbtInd: balance.creditDebitIndicator === 'credit' ? 'CRDT' : 'DBIT',
        Tp: {
            Cd: balance.type, // TODO add Prtry handling
        },
        ValDt: {
            Dt: balance.valueDate?.toISOString().slice(0, 10),
        },
        PrcgDt: {
            DtTm: balance.processingDate?.toISOString(),
        },
    };
    return obj;
};
const parseEntry = (entry) => {
    const referenceId = entry.NtryRef;
    const creditDebitIndicator = entry.CdtDbtInd === 'CRDT' ? 'credit' : 'debit';
    const bookingDate = parseDate(entry.BookgDt);
    const reversal = entry.RvslInd === true;
    const rawAmount = entry.Amt['#text'];
    const currency = entry.Amt['@_Ccy'];
    const amount = parseAmountToMinorUnits(rawAmount, currency);
    const proprietaryCode = entry.BkTxCd.Prtry?.Cd;
    const additionalInformation = parseAdditionalInformation(entry.AddtlNtryInf);
    const accountServicerReferenceId = entry.AcctSvcrRef;
    const bankTransactionCode = parseBankTransactionCode(entry.BkTxCd);
    // Currently, we flatten entry details into a list of TransactionDetails
    let rawEntryDetails = entry.NtryDtls || [];
    if (!Array.isArray(rawEntryDetails)) {
        rawEntryDetails = [rawEntryDetails];
    }
    const transactions = rawEntryDetails
        .map((rawDetail) => {
        // Get list of transaction details, even if it's singleton
        let transactionDetails = rawDetail.TxDtls || [];
        if (!Array.isArray(transactionDetails)) {
            transactionDetails = [transactionDetails];
        }
        return transactionDetails.map(parseTransactionDetail);
    })
        .flat();
    return {
        referenceId,
        creditDebitIndicator,
        bookingDate,
        reversal,
        amount,
        currency,
        proprietaryCode,
        transactions,
        additionalInformation,
        accountServicerReferenceId,
        bankTransactionCode,
    };
};
const exportEntry = (entry) => {
    const obj = {
        NtryRef: entry.referenceId,
        CdtDbtInd: entry.creditDebitIndicator === 'credit' ? 'CRDT' : 'DBIT',
        BookgDt: {
            DtTm: entry.bookingDate.toISOString(),
        },
        RvslInd: entry.reversal,
        Amt: {
            '#text': exportAmountToString(entry.amount, entry.currency),
            '@_Ccy': entry.currency,
        },
        BkTxCd: exportBankTransactionCode(entry.bankTransactionCode, entry.proprietaryCode),
        AddtlNtryInf: entry.additionalInformation,
        AcctSvcrRef: entry.accountServicerReferenceId,
        NtryDtls: entry.transactions.map((tx) => ({ TxDtls: exportTransactionDetails(tx) }))
    };
    return obj;
};
const parseTransactionDetail = (transactionDetail) => {
    const messageId = transactionDetail.Refs?.MsgId;
    const accountServicerReferenceId = transactionDetail.Refs?.AcctSvcrRef;
    const paymentInformationId = transactionDetail.Refs?.PmtInfId;
    const remittanceInformation = transactionDetail.RmtInf?.Ustrd;
    const proprietaryPurpose = transactionDetail.Purp?.Prtry;
    const returnReason = transactionDetail.RtrInf?.Rsn;
    const returnAdditionalInformation = transactionDetail.RtrInf?.AddtlInf;
    const endToEndId = transactionDetail.Refs?.EndToEndId;
    // Get Debtor information if 'Dbtr' is present
    let debtor;
    let debtorName;
    let debtorAccount;
    let debtorAgent;
    if (transactionDetail.RltdPties?.Dbtr) {
        debtorName = transactionDetail.RltdPties.Dbtr.Nm;
    }
    if (transactionDetail.RltdPties?.DbtrAcct) {
        debtorAccount = parseAccount(transactionDetail.RltdPties.DbtrAcct);
    }
    if (transactionDetail.RltdAgts?.DbtrAgt) {
        debtorAgent = parseAgent(transactionDetail.RltdAgts.DbtrAgt);
    }
    if (debtorName || debtorAccount || debtorAgent) {
        debtor = {
            name: debtorName,
            account: debtorAccount,
            agent: debtorAgent,
        };
    }
    // Get Creditor information if 'Cdtr' is presentt
    let creditor;
    let creditorName;
    let creditorAccount;
    let creditorAgent;
    if (transactionDetail.RltdPties?.Cdtr) {
        creditorName = transactionDetail.RltdPties.Cdtr.Nm;
    }
    if (transactionDetail.RltdPties?.CdtrAcct) {
        creditorAccount = parseAccount(transactionDetail.RltdPties.CdtrAcct);
    }
    if (transactionDetail.RltdAgts?.CdtrAgt) {
        creditorAgent = parseAgent(transactionDetail.RltdAgts.CdtrAgt);
    }
    if (creditorName || creditorAccount || creditorAgent) {
        creditor = {
            name: creditorName,
            account: creditorAccount,
            agent: creditorAgent,
        };
    }
    return {
        messageId,
        accountServicerReferenceId,
        endToEndId,
        paymentInformationId,
        remittanceInformation,
        proprietaryPurpose,
        returnReason,
        returnAdditionalInformation,
        debtor,
        creditor,
    };
};
const exportTransactionDetails = (tx) => {
    const obj = {
        Refs: {
            MsgId: tx.messageId,
            AcctSvcrRef: tx.accountServicerReferenceId,
            PmtInfId: tx.paymentInformationId,
            EndToEndId: tx.endToEndId,
        },
        RmtInf: {
            Ustrd: tx.remittanceInformation,
        },
        Purp: {
            Prtry: tx.proprietaryPurpose,
        },
        RtrInf: {
            Rsn: tx.returnReason,
            AddtlInf: tx.returnAdditionalInformation,
        },
    };
    if (tx.debtor) {
        obj.RltdPties = {
            ...obj.RltdPties,
            Dbtr: {
                Nm: tx.debtor.name,
            },
            DbtrAcct: tx.debtor.account ? exportAccount(tx.debtor.account) : undefined,
        };
        obj.RltdAgts = {
            DbtrAgt: tx.debtor.agent ? exportAgent(tx.debtor.agent) : undefined,
        };
    }
    if (tx.creditor) {
        obj.RltdPties = {
            ...obj.RltdPties,
            Cdtr: {
                Nm: tx.creditor.name,
            },
            CdtrAcct: tx.creditor.account ? exportAccount(tx.creditor.account) : undefined,
        };
        obj.RltdAgts = {
            CdtrAgt: tx.creditor.agent ? exportAgent(tx.creditor.agent) : undefined,
        };
    }
    return obj;
};
const parseBankTransactionCode = (transactionCode) => {
    const domainCode = transactionCode?.Domn?.Cd;
    const domainFamilyCode = transactionCode?.Domn?.Fmly?.Cd;
    const domainSubFamilyCode = transactionCode?.Domn?.Fmly?.SubFmlyCd;
    const proprietaryCode = transactionCode.Prtry?.Cd;
    const proprietaryCodeIssuer = transactionCode.Prtry?.Issr;
    return {
        domainCode,
        domainFamilyCode,
        domainSubFamilyCode,
        proprietaryCode,
        proprietaryCodeIssuer,
    };
};
const exportBankTransactionCode = (bankTransactionCode, proprietaryCode) => {
    const obj = {};
    if (proprietaryCode) {
        obj.Prtry = { Cd: proprietaryCode };
    }
    if (bankTransactionCode) {
        obj.Domn = {
            Cd: bankTransactionCode.domainCode,
            Fmly: {
                Cd: bankTransactionCode.domainFamilyCode,
                SubFmlyCd: bankTransactionCode.domainSubFamilyCode,
            },
        };
        if (bankTransactionCode.proprietaryCode) {
            obj.Prtry = {
                Cd: bankTransactionCode.proprietaryCode,
                Issr: bankTransactionCode.proprietaryCodeIssuer,
            };
        }
    }
    return obj;
};
const parseBusinessError = (bizErr) => {
    const code = bizErr.Err?.Cd || bizErr.Err?.Prtry || "UKNW";
    const description = bizErr.Desc;
    return {
        code,
        description,
    };
};
const exportBusinessError = (bizErr) => {
    const obj = {
        Err: {
            Cd: bizErr.code, // TODO: Add Prtry handling
        },
        Desc: bizErr.description,
    };
    return obj;
};

class CashManagementReturnAccount {
    _data;
    constructor(data) {
        this._data = data;
    }
    get data() {
        return this._data;
    }
    static supportedMessages() {
        return [ISO20022Messages.CAMT_004];
    }
    static fromDocumentOject(doc) {
        const rawHeader = doc.Document?.RtrAcct?.MsgHdr;
        if (!rawHeader) {
            throw new InvalidStructureError("Invalid CAMT.004 document: missing MsgHdr");
        }
        const header = parseMessageHeader(rawHeader);
        // interpret the report
        let rawReports = doc.Document?.RtrAcct?.RptOrErr?.AcctRpt;
        if (!Array.isArray(rawReports))
            rawReports = [rawReports];
        rawReports = rawReports.filter((r) => !!r); // remove null/undefined
        const reports = rawReports.map((r) => {
            const accountId = parseAccountIdentification(r.AcctId);
            let report = undefined;
            let error = undefined;
            if (r.AcctOrErr?.Acct) {
                // report
                if (!r.AcctOrErr.Acct.Ccy) {
                    throw new InvalidStructureError("Invalid CAMT.004 document: missing Ccy in Acct");
                }
                let rawMulBal = r.AcctOrErr.Acct.MulBal;
                if (!Array.isArray(rawMulBal))
                    rawMulBal = [rawMulBal];
                rawMulBal = rawMulBal.filter((b) => !!b);
                report = {
                    currency: r.AcctOrErr.Acct.Ccy,
                    name: r.AcctOrErr.Acct.Nm,
                    type: r.AcctOrErr.Acct.Tp?.Cd || r.AcctOrErr.Acct.Tp?.Prtry,
                    balances: rawMulBal.map((bal) => parseBalanceReport(r.AcctOrErr.Acct.Ccy, bal)),
                };
                if (report.balances.length === 0) {
                    throw new InvalidStructureError("Invalid CAMT.004 document: missing MulBal in Acct");
                }
            }
            else if (r.AcctOrErr?.BizErr) {
                // business error
                error = parseBusinessError(r.AcctOrErr.BizErr);
            }
            else {
                throw new InvalidStructureError("Invalid CAMT.004 document: missing AcctOrErr");
            }
            return { accountId, report, error };
        });
        return new CashManagementReturnAccount({
            header,
            reports,
        });
    }
    static fromXML(xml) {
        const parser = XML.getParser();
        const doc = parser.parse(xml);
        if (!doc.Document) {
            throw new Error("Invalid XML format");
        }
        const namespace = (doc.Document['@_xmlns'] || doc.Document['@_Xmlns']);
        if (!namespace.startsWith('urn:iso:std:iso:20022:tech:xsd:camt.004.001.')) {
            throw new InvalidXmlNamespaceError('Invalid CAMT.004 namespace');
        }
        return CashManagementReturnAccount.fromDocumentOject(doc);
    }
    static fromJSON(json) {
        const obj = JSON.parse(json);
        if (!obj.Document) {
            throw new Error("Invalid JSON format");
        }
        return CashManagementReturnAccount.fromDocumentOject(obj);
    }
    serialize() {
        const builder = XML.getBuilder();
        const obj = this.toJSON();
        obj.Document['@_xmlns'] = 'urn:iso:std:iso:20022:tech:xsd:camt.004.001.02';
        obj.Document['@_xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
        return builder.build(obj);
    }
    toJSON() {
        // we should not have to serialize but we do it for consistency
        const Document = {
            RtrAcct: {
                MsgHdr: exportMessageHeader(this._data.header),
                RptOrErr: {
                    AcctRpt: this._data.reports.map((report) => {
                        const obj = {
                            AcctId: exportAccountIdentification(report.accountId),
                            AcctOrErr: {}, // filled below
                        };
                        if (report.report) {
                            obj.AcctOrErr.Acct = {
                                Ccy: report.report.currency,
                                Nm: report.report.name,
                                Tp: { Cd: report.report.type }, // TODO add Prtry handling
                                MulBal: report.report.balances.map((bal) => exportBalanceReport(report.report.currency, bal)),
                            };
                        }
                        else if (report.error) {
                            obj.AcctOrErr.BizErr = exportBusinessError(report.error);
                        }
                        return obj;
                    })
                }
            }
        };
        return { Document };
    }
}
registerISO20022Implementation(CashManagementReturnAccount);

class CashManagementGetTransaction {
    _data;
    constructor(data) {
        this._data = data;
    }
    get data() {
        return this._data;
    }
    static supportedMessages() {
        return [ISO20022Messages.CAMT_005];
    }
    static fromDocumentOject(doc) {
        const rawHeader = doc.Document?.GetTx?.MsgHdr;
        if (!rawHeader) {
            throw new InvalidStructureError("Invalid CAMT.005 document: missing MsgHdr");
        }
        const header = parseMessageHeader(rawHeader);
        const newCrit = doc.Document?.GetTx?.TxQryDef?.TxCrit?.NewCrit;
        if (!newCrit) {
            throw new InvalidStructureError("Invalid CAMT.005 document: missing GetTx.TxQryDef.TxCrit.NewCrit");
        }
        const name = newCrit.NewQryNm;
        let searchCriteria = [];
        let rawCriterias = newCrit.SchCrit;
        if (!Array.isArray(rawCriterias)) {
            rawCriterias = [rawCriterias];
        }
        rawCriterias = rawCriterias.filter((c) => !!c);
        if (rawCriterias.length === 0) {
            throw new InvalidStructureError("Invalid CAMT.005 document: missing search criteria");
        }
        for (const rawCriterium of rawCriterias) {
            // search on Ids
            if (rawCriterium.PmtSch.MsgId) {
                searchCriteria.push({
                    type: "PmtSch.MsgId",
                    msgIdsEqualTo: Array.isArray(rawCriterium.PmtSch.MsgId) ? rawCriterium.PmtSch.MsgId : [rawCriterium.PmtSch.MsgId],
                });
            }
            // seach on date
            if (rawCriterium.PmtSch.ReqdExctnDt) {
                if (Array.isArray(rawCriterium.PmtSch.ReqdExctnDt) && rawCriterium.PmtSch.ReqdExctnDt.length > 1) {
                    throw new InvalidStructureError("Invalid CAMT.005 document: multiple ReqdExctnDt criterium not supported");
                }
                const criterium = Array.isArray(rawCriterium.PmtSch.ReqdExctnDt) ? rawCriterium.PmtSch.ReqdExctnDt[0] : rawCriterium.PmtSch.ReqdExctnDt;
                if (criterium?.DtSch?.EQDt) {
                    searchCriteria.push({
                        type: "PmtSch.ReqdExctnDt",
                        dateEqualTo: parseDate(criterium.DtSch.EQDt),
                    });
                }
            }
            let pmtIds = Array.isArray(rawCriterium.PmtSch.PmtId) ? rawCriterium.PmtSch.PmtId : [rawCriterium.PmtSch.PmtId];
            pmtIds = pmtIds.filter((p) => !!p && p.LngBizId?.EndToEndId);
            if (pmtIds.length > 0) {
                searchCriteria.push({
                    type: "PmtSch.PmtId.LngBizId.EndToEndId",
                    endToEndIdEqualTo: pmtIds.map((id) => id.LngBizId.EndToEndId),
                });
            }
        }
        return new CashManagementGetTransaction({
            header,
            newCriteria: {
                name,
                searchCriteria,
            },
        });
    }
    static fromXML(xml) {
        const parser = XML.getParser();
        const doc = parser.parse(xml);
        if (!doc.Document) {
            throw new Error("Invalid XML format");
        }
        const namespace = (doc.Document['@_xmlns'] || doc.Document['@_Xmlns']);
        if (!namespace.startsWith('urn:iso:std:iso:20022:tech:xsd:camt.005.001.')) {
            throw new InvalidXmlNamespaceError('Invalid CAMT.005 namespace');
        }
        return CashManagementGetTransaction.fromDocumentOject(doc);
    }
    static fromJSON(json) {
        const obj = JSON.parse(json);
        if (!obj.Document) {
            throw new Error("Invalid JSON format");
        }
        return CashManagementGetTransaction.fromDocumentOject(obj);
    }
    serialize() {
        const builder = XML.getBuilder();
        const obj = this.toJSON();
        obj.Document['@_xmlns'] = 'urn:iso:std:iso:20022:tech:xsd:camt.005.001.02';
        obj.Document['@_xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
        return builder.build(obj);
    }
    toJSON() {
        // we should not have to serialize but we do it for consistency
        const Document = {
            GetTx: {
                MsgHdr: exportMessageHeader(this._data.header),
                TxQryDef: {
                    TxCrit: {
                        NewCrit: {
                            NewQryNm: this._data.newCriteria?.name,
                            SchCrit: this._data.newCriteria?.searchCriteria.map((c) => {
                                const obj = {};
                                if (c.type === "PmtSch.MsgId" && c.msgIdsEqualTo) {
                                    obj.PmtSch = {
                                        MsgId: c.msgIdsEqualTo
                                    };
                                }
                                if (c.type === "PmtSch.ReqdExctnDt" && c.dateEqualTo) {
                                    obj.PmtSch = {
                                        ReqdExctnDt: {
                                            DtSch: {
                                                EQDt: c.dateEqualTo.toISOString().slice(0, 10),
                                            }
                                        }
                                    };
                                }
                                if (c.type === "PmtSch.PmtId.LngBizId.EndToEndId" && c.endToEndIdEqualTo) {
                                    obj.PmtSch = {
                                        PmtId: c.endToEndIdEqualTo.map((id) => ({
                                            LngBizId: {
                                                EndToEndId: id,
                                            }
                                        }))
                                    };
                                }
                                return obj;
                            }),
                        }
                    }
                }
            }
        };
        return { Document };
    }
}
registerISO20022Implementation(CashManagementGetTransaction);

class CashManagementReturnTransaction {
    _data;
    constructor(data) {
        this._data = data;
    }
    get data() {
        return this._data;
    }
    static supportedMessages() {
        return [ISO20022Messages.CAMT_006];
    }
    static fromDocumentOject(doc) {
        const rawHeader = doc.Document?.RtrTx?.MsgHdr;
        if (!rawHeader) {
            throw new InvalidStructureError("Invalid CAMT.006 document: missing MsgHdr");
        }
        const header = parseMessageHeader(rawHeader);
        // interpret the report
        let rawReports = doc.Document?.RtrTx?.RptOrErr?.BizRpt?.TxRpt;
        if (!Array.isArray(rawReports))
            rawReports = [rawReports];
        rawReports = rawReports.filter((r) => !!r); // remove null/undefined
        const reports = rawReports.map((r) => {
            const rawAmount = r.PmtId?.LngBizId?.IntrBkSttlmAmt?.Amt || r.PmtId?.LngBizId?.IntrBkSttlmAmt?.Amount; // some implementations use Amount instead of Amt
            const paymentId = {
                currency: r.PmtId?.LngBizId?.IntrBkSttlmAmt?.Ccy,
                amount: parseAmountToMinorUnits(rawAmount, r.PmtId?.LngBizId?.IntrBkSttlmAmt?.Ccy),
                endToEndId: r.PmtId?.LngBizId?.EndToEndId,
                transactionId: r.PmtId?.LngBizId?.TxId,
                uetr: r.PmtId?.LngBizId?.UETR,
            };
            // check required fields
            if (!paymentId.currency) {
                throw new InvalidStructureError("Invalid CAMT.006 document: missing Ccy in PmtId.LngBizId.IntrBkSttlmAmt");
            }
            if (paymentId.amount === undefined || paymentId.amount === null || isNaN(paymentId.amount)) {
                throw new InvalidStructureError("Invalid CAMT.006 document: missing or invalid Amt in PmtId.LngBizId.IntrBkSttlmAmt");
            }
            if (!paymentId.endToEndId) {
                throw new InvalidStructureError("Invalid CAMT.006 document: missing EndToEndId in PmtId.LngBizId");
            }
            let report = undefined;
            let error = undefined;
            if (r.TxOrErr?.Tx) {
                // report
                const msgId = r.TxOrErr.Tx.Pmt?.MsgId;
                const reqExecutionDate = r.TxOrErr.Tx.Pmt?.ReqdExctnDt?.Dt ? parseDate(r.TxOrErr.Tx.Pmt.ReqdExctnDt) : undefined;
                const status = ((sts) => {
                    if (!sts)
                        return undefined;
                    if (Array.isArray(sts) && sts.length === 0)
                        return undefined;
                    if (Array.isArray(sts))
                        sts = sts[0]; // take the first one only
                    let code = sts.Cd?.Pdg || sts.Cd?.Fnl || sts.Cd?.RTGS || sts.Cd?.Sttlm || sts.Cd?.Prtly;
                    if (code)
                        code = Object.keys(sts.Cd)[0] + ":" + code; // prefix with the type of code
                    else
                        return undefined;
                    const reason = sts.Rsn?.Prtry;
                    return { code, reason };
                })(r.TxOrErr.Tx.Pmt?.Sts);
                // to parse debtor and creditor with their agents
                function parseParty$1(party) {
                    const p = parseParty(party?.Pty || {}); // force a valid object
                    if (party?.Agt)
                        p.agent = { bic: party.Agt.FinInstnId?.BICFI };
                    return p;
                }
                function parseAgent(agent) {
                    if (!agent)
                        return { bic: "" };
                    return { bic: agent?.FinInstnId?.BICFI };
                }
                report = {
                    msgId,
                    reqExecutionDate,
                    status,
                    debtor: parseParty$1(r.TxOrErr.Tx.Pmt?.Pties?.Dbtr),
                    debtorAgent: parseAgent(r.TxOrErr.Tx.Pmt?.Pties?.DbtrAgt),
                    creditor: parseParty$1(r.TxOrErr.Tx.Pmt?.Pties?.Cdtr),
                    creditorAgent: parseAgent(r.TxOrErr.Tx.Pmt?.Pties?.CdtrAgt),
                };
                // check the debtor and creditor required fields
                if (!report.debtor.id) {
                    throw new InvalidStructureError("Invalid CAMT.006 document: missing Id in TxOrErr.Tx.Dbtr.Pty");
                }
                if (!report.creditor.id) {
                    throw new InvalidStructureError("Invalid CAMT.006 document: missing Id in TxOrErr.Tx.Cdtr.Pty");
                }
            }
            else if (r.TxOrErr?.BizErr) {
                // business error
                error = parseBusinessError(r.TxOrErr.BizErr);
            }
            else {
                throw new InvalidStructureError("Invalid CAMT.006 document: missing TxOrErr");
            }
            return { paymentId, report, error };
        });
        return new CashManagementReturnTransaction({
            header,
            reports,
        });
    }
    static fromXML(xml) {
        const parser = XML.getParser();
        const doc = parser.parse(xml);
        if (!doc.Document) {
            throw new Error("Invalid XML format");
        }
        const namespace = (doc.Document['@_xmlns'] || doc.Document['@_Xmlns']);
        if (!namespace.startsWith('urn:iso:std:iso:20022:tech:xsd:camt.004.001.')) {
            throw new InvalidXmlNamespaceError('Invalid CAMT.004 namespace');
        }
        return CashManagementReturnTransaction.fromDocumentOject(doc);
    }
    static fromJSON(json) {
        const obj = JSON.parse(json);
        if (!obj.Document) {
            throw new Error("Invalid JSON format");
        }
        return CashManagementReturnTransaction.fromDocumentOject(obj);
    }
    serialize() {
        const builder = XML.getBuilder();
        const obj = this.toJSON();
        obj.Document['@_xmlns'] = 'urn:iso:std:iso:20022:tech:xsd:camt.004.001.02';
        obj.Document['@_xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
        return builder.build(obj);
    }
    toJSON() {
        // we should not have to serialize but we do it for consistency
        const Document = {
            RtrTx: {
                MsgHdr: exportMessageHeader(this._data.header),
                RptOrErr: {
                    BizRpt: {
                        TxRpt: this._data.reports.map((report) => {
                            const obj = {
                                PmtId: {
                                    LngBizId: {
                                        IntrBkSttlmAmt: {
                                            Amt: exportAmountToString(report.paymentId.amount, report.paymentId.currency),
                                            Amount: exportAmountToString(report.paymentId.amount, report.paymentId.currency), // some implementations use Amount instead of Amt
                                            Ccy: report.paymentId.currency,
                                        },
                                        UETR: report.paymentId.uetr,
                                        TxId: report.paymentId.transactionId,
                                        EndToEndId: report.paymentId.endToEndId,
                                    }
                                },
                                TxOrErr: {}, // filled below
                            };
                            if (report.report) {
                                function exportParty(p) {
                                    if (!p)
                                        return undefined;
                                    return {
                                        Pty: {
                                            Nm: p.name,
                                            Id: p.id ? { OrgId: { Othr: { Id: p.id } } } : undefined,
                                        },
                                        Agt: exportAgent(p.agent),
                                    };
                                }
                                function exportAgent(a) {
                                    if (!a)
                                        return undefined;
                                    if ("bic" in a && a.bic)
                                        return { FinInstnId: { BICFI: a.bic } };
                                    if ("abaRoutingNumber" in a && a.abaRoutingNumber)
                                        return { FinInstId: { Othr: { Id: a.abaRoutingNumber } } };
                                    return undefined;
                                }
                                const [codeType, code] = report.report.status ? report.report.status.code.split(":") : [undefined, undefined];
                                obj.TxOrErr.Tx = {
                                    Pmt: {
                                        MsgId: report.report.msgId,
                                        ReqdExctnDt: { Dt: report.report.reqExecutionDate?.toISOString()?.slice(0, 10) },
                                        Sts: {
                                            Cd: codeType ? { [codeType]: code } : undefined,
                                            Rsn: report.report.status?.reason ? { Prtry: report.report.status.reason } : undefined,
                                        },
                                        Pties: {
                                            Dbtr: exportParty(report.report.debtor),
                                            DbtrAgt: exportAgent(report.report.debtorAgent),
                                            Cdtr: exportParty(report.report.creditor),
                                            CdtrAgt: exportAgent(report.report.creditorAgent),
                                        }
                                    }
                                };
                            }
                            else if (report.error) {
                                obj.TxOrErr.BizErr = exportBusinessError(report.error);
                            }
                            return obj;
                        })
                    }
                }
            }
        };
        return { Document };
    }
}
registerISO20022Implementation(CashManagementReturnTransaction);

// Types related to CAMT 053
/**
 * Balance types as defined in ISO 20022.
 * @see {@link https://www.iso20022.org/sites/default/files/2022-03/externalcodesets_4q2021_v2_1.xlsx}
 */
const BalanceTypeCode = {
    /** Closing balance of amount of money that is at the disposal of the account owner on the date specified. */
    ClosingAvailable: 'CLAV',
    /** Balance of the account at the end of the pre-agreed account reporting period. It is the sum of the opening booked balance at the beginning of the period and all entries booked to the account during the pre-agreed account reporting period. */
    ClosingBooked: 'CLBD',
    /** Forward available balance of money that is at the disposal of the account owner on the date specified. */
    ForwardAvailable: 'FWAV',
    /** Balance for informational purposes. */
    Information: 'INFO',
    /** Available balance calculated in the course of the account servicer's business day, at the time specified, and subject to further changes during the business day. The interim balance is calculated on the basis of booked credit and debit items during the calculation time/period specified. */
    InterimAvailable: 'ITAV',
    /** Balance calculated in the course of the account servicer's business day, at the time specified, and subject to further changes during the business day. The interim balance is calculated on the basis of booked credit and debit items during the calculation time/period specified. */
    InterimBooked: 'ITBD',
    /** Opening balance of amount of money that is at the disposal of the account owner on the date specified. */
    OpeningAvailable: 'OPAV',
    /** Book balance of the account at the beginning of the account reporting period. It always equals the closing book balance from the previous report. */
    OpeningBooked: 'OPBD',
    /** Balance of the account at the previously closed account reporting period. The opening booked balance for the new period has to be equal to this balance. Usage: the previously booked closing balance should equal (inclusive date) the booked closing balance of the date it references and equal the actual booked opening balance of the current date. */
    PreviouslyClosedBooked: 'PRCD',
    /** Balance, composed of booked entries and pending items known at the time of calculation, which projects the end of day balance if everything is booked on the account and no other entry is posted. */
    Expected: 'XPCD',
    /** The difference between the excess/(deficit) investable balance and the excess/(deficit) collected balance due to the reserve requirement. This balance is not used if the account's Earnings Credit Rate is net of reserves. This may be used when the earnings allowance rate is not adjusted for reserves. It may be that reserves have been subtracted from the collected balance to determine the investable balance. Therefore, they must be added back to the excess/(deficit) investable balance to determine the collected balance position. The presentation of this calculation is optional. AFP code=00 04 21 */
    AdditionalBalReserveRequirement: 'ABRR',
};
/**
 * Description mapping of BalanceTypeCode values to their names.
 */
const BalanceTypeCodeDescriptionMap = {
    'CLAV': 'Closing Available',
    'CLBD': 'Closing Booked',
    'FWAV': 'Forward Available',
    'INFO': 'Information',
    'ITAV': 'Interim Available',
    'ITBD': 'Interim Booked',
    'OPAV': 'Opening Available',
    'OPBD': 'Opening Booked',
    'PRCD': 'Previously Closed Booked',
    'XPCD': 'Expected',
    'ABRR': 'Additional Balance Reserve Requirement'
};

/**
 * Represents an ISO20022 core message creator.
 * This class provides methods to create various basic ISO20022 compliant messages.
 *
 * @example
 * const iso20022 = new ISO20022({
 *     initiatingParty: {
 *         name: 'Example Corp',
 *         id: 'EXAMPLECORP',
 *         account: {
 *             accountNumber: '123456789',
 *         },
 *         agent: {
 *             bic: 'CHASUS33',
 *             bankAddress: {
 *                 country: 'US',
 *             },
 *         },
 *     },
 * });
 */
class ISO20022 {
    initiatingParty;
    /**
     * Creates an instance of ISO20022.
     * @param {ISO20022Config} config - The configuration object for ISO20022.
     */
    constructor(config) {
        this.initiatingParty = config.initiatingParty;
    }
    /**
     * Creates a SWIFT Credit Payment Initiation message.
     * @param {SWIFTCreditPaymentInitiationConfig} config - Configuration containing payment instructions and optional parameters.
     * @example
     * const payment = iso20022.createSWIFTCreditPaymentInitiation({
     *   paymentInstructions: [
     *     {
     *       type: 'swift',
     *       direction: 'credit',
     *       amount: 1000,
     *       currency: 'USD',
     *       creditor: {
     *         name: 'Hans Schneider',
     *         account: {
     *           iban: 'DE1234567890123456',
     *         },
     *         agent: {
     *           bic: 'DEUTDEFF',
     *           bankAddress: {
     *             country: 'DE',
     *           },
     *         },
     *         address: {
     *           streetName: 'Hauptstraße',
     *           buildingNumber: '42',
     *           postalCode: '10115',
     *           townName: 'Berlin',
     *           country: 'DE',
     *         },
     *       },
     *       remittanceInformation: 'Invoice payment #123',
     *     },
     *   ],
     *   messageId: 'SWIFT-MSG-001', // Optional
     *   creationDate: new Date('2025-03-01'), // Optional
     * });
     * @returns {SWIFTCreditPaymentInitiation} A new SWIFT Credit Payment Initiation object.
     */
    createSWIFTCreditPaymentInitiation(config) {
        return new SWIFTCreditPaymentInitiation({
            initiatingParty: this.initiatingParty,
            paymentInstructions: config.paymentInstructions,
            messageId: config.messageId,
            creationDate: config.creationDate,
        });
    }
    /**
     * Creates a SEPA Credit Payment Initiation message.
     * @param {SEPACreditPaymentInitiationConfig} config - Configuration containing payment instructions and optional parameters.
     * @example
     * const payment = iso20022.createSEPACreditPaymentInitiation({
     *   paymentInstructions: [
     *     {
     *       type: 'sepa',
     *       direction: 'credit',
     *       amount: 1000, // €10.00 Euros
     *       currency: 'EUR',
     *       creditor: {
     *         name: 'Hans Schneider',
     *         account: {
     *           iban: 'DE1234567890123456',
     *         },
     *       },
     *       remittanceInformation: 'Invoice payment #123',
     *     },
     *   ],
     *   messageId: 'SEPA-MSG-001', // Optional
     *   creationDate: new Date('2025-03-01'), // Optional
     * });
     * @returns {SEPACreditPaymentInitiation} A new SEPA Credit Payment Initiation object.
     */
    createSEPACreditPaymentInitiation(config) {
        return new SEPACreditPaymentInitiation({
            initiatingParty: this.initiatingParty,
            paymentInstructions: config.paymentInstructions,
            messageId: config.messageId,
            creationDate: config.creationDate,
        });
    }
    /**
     * Creates a RTP Credit Payment Initiation message.
     * @param {RTPCreditPaymentInitiationConfig} config - Configuration containing payment instructions and optional parameters.
     * @example
     * const payment = iso20022.createRTPCreditPaymentInitiation({
     *   paymentInstructions: [
     *     {
     *       type: 'rtp',
     *       direction: 'credit',
     *       amount: 100000, // $1000.00
     *       currency: 'USD',
     *       creditor: {
     *         name: 'All-American Dogs Co.',
     *         account: {
     *           accountNumber: '123456789012',
     *         },
     *         agent: {
     *           abaRoutingNumber: '37714568112',
     *         },
     *       },
     *       remittanceInformation: '1000 Hot Dogs Feb26',
     *     },
     *   ],
     *   messageId: 'RTP-MSG-001', // Optional
     *   creationDate: new Date('2025-03-01'), // Optional
     * });
     * @returns {RTPCreditPaymentInitiation} A new RTP Credit Payment Initiation object.
     */
    createRTPCreditPaymentInitiation(config) {
        return new RTPCreditPaymentInitiation({
            initiatingParty: this.initiatingParty,
            paymentInstructions: config.paymentInstructions,
            messageId: config.messageId,
            creationDate: config.creationDate,
        });
    }
    /**
     * Creates an ACH Credit Payment Initiation message.
     * @param {ACHCreditPaymentInitiationConfig} config - Configuration containing payment instructions and optional parameters.
     * @example
     * const payment = iso20022.createACHCreditPaymentInitiation({
     *   paymentInstructions: [
     *     {
     *       type: 'ach',
     *       direction: 'credit',
     *       amount: 100000, // $1000.00
     *       currency: 'USD',
     *       creditor: {
     *         name: 'John Doe Funding LLC',
     *         account: {
     *           accountNumber: '123456789012',
     *         },
     *         agent: {
     *           abaRoutingNumber: '123456789',
     *         },
     *       },
     *       remittanceInformation: 'Invoice #12345',
     *     },
     *   ],
     *   messageId: 'ACH-MSG-001', // Optional
     *   creationDate: new Date('2025-03-01'), // Optional
     * });
     * @returns {ACHCreditPaymentInitiation} A new ACH Credit Payment Initiation object.
     */
    createACHCreditPaymentInitiation(config) {
        return new ACHCreditPaymentInitiation({
            initiatingParty: this.initiatingParty,
            paymentInstructions: config.paymentInstructions,
            messageId: config.messageId,
            creationDate: config.creationDate,
        });
    }
    /** Create a message CAMT or other */
    createMessage(type, config) {
        const implementation = getISO20022Implementation(type);
        if (!implementation) {
            throw new Error(`No implementation found for message type ${type}`);
        }
        return new implementation(config);
    }
}

/**
 * Represents the status codes in a payment status report.
 * @see {@link https://www.iso20022.org/sites/default/files/2022-03/externalcodesets_4q2021_v2_1.xlsx}
 */
const PaymentStatusCode = {
    Rejected: 'RJCT',
    PartiallyAccepted: 'ACCP',
    Pending: 'PNDG',
    Accepted: 'ACCP',
    AcceptedSettlementInProgress: 'ACSP',
    AcceptedCreditSettlementCompleted: 'ACSC',
    AcceptedSettlementCompleted: 'ACSC',
    AcceptedTechnicalValidation: 'ACTC',
};

// NOTE: Consider not even using this switch statement.
const parseStatus = (status) => {
    switch (status) {
        case PaymentStatusCode.Rejected:
            return PaymentStatusCode.Rejected;
        case PaymentStatusCode.PartiallyAccepted:
            return PaymentStatusCode.PartiallyAccepted;
        case PaymentStatusCode.Pending:
            return PaymentStatusCode.Pending;
        case PaymentStatusCode.Accepted:
            return PaymentStatusCode.Accepted;
        case PaymentStatusCode.AcceptedSettlementInProgress:
            return PaymentStatusCode.AcceptedSettlementInProgress;
        case PaymentStatusCode.AcceptedCreditSettlementCompleted:
            return PaymentStatusCode.AcceptedCreditSettlementCompleted;
        case PaymentStatusCode.AcceptedSettlementCompleted:
            return PaymentStatusCode.AcceptedSettlementCompleted;
        case PaymentStatusCode.AcceptedTechnicalValidation:
            return PaymentStatusCode.AcceptedTechnicalValidation;
        default:
            throw new Error(`Unknown status: ${status}`);
    }
};
const parseGroupStatusInformation = (originalGroupInfAndStatus) => {
    if (!originalGroupInfAndStatus.hasOwnProperty('GrpSts')) {
        return null;
    }
    return {
        type: 'group',
        originalMessageId: originalGroupInfAndStatus.OrgnlMsgId,
        status: parseStatus(originalGroupInfAndStatus.GrpSts),
        reason: {
            code: originalGroupInfAndStatus.StsRsnInf?.Rsn?.Cd,
            additionalInformation: parseAdditionalInformation(originalGroupInfAndStatus.StsRsnInf?.AddtlInf),
        },
    };
};
const parsePaymentStatusInformations = (originalPaymentInfAndStatuses) => {
    return originalPaymentInfAndStatuses
        .map((payment) => {
        if (!payment.hasOwnProperty('PmtInfSts')) {
            return null;
        }
        return {
            type: 'payment',
            originalPaymentId: payment.OrgnlPmtInfId,
            status: parseStatus(payment.PmtInfSts),
            reason: {
                code: payment.StsRsnInf?.Rsn?.Cd,
                additionalInformation: parseAdditionalInformation(payment.StsRsnInf?.AddtlInf),
            },
        };
    })
        .filter((status) => status !== null);
};
const parseTransactionStatusInformations = (allTxnsInfoAndStatuses) => {
    const transactionStatuses = allTxnsInfoAndStatuses.map((transaction) => {
        return {
            type: 'transaction',
            originalEndToEndId: transaction.OrgnlEndToEndId,
            status: parseStatus(transaction.TxSts),
            reason: {
                code: transaction.StsRsnInf?.Rsn?.Cd,
                additionalInformation: parseAdditionalInformation(transaction.StsRsnInf?.Rsn?.AddtlInf),
            },
        };
    });
    return transactionStatuses;
};

/**
 * Represents a Payment Status Report, containing information about the status of payments and transactions.
 */
class PaymentStatusReport {
    _messageId;
    _creationDate;
    _initatingParty;
    _originalGroupInformation;
    _statusInformations;
    /**
     * Creates a new PaymentStatusReport instance.
     * @param {PaymentStatusReportConfig} config - The configuration object for the PaymentStatusReport.
     */
    constructor(config) {
        this._messageId = config.messageId;
        this._creationDate = config.creationDate;
        this._initatingParty = config.initatingParty;
        this._originalGroupInformation = config.originalGroupInformation;
        this._statusInformations = config.statusInformations;
    }
    /**
     * Creates a PaymentStatusReport instance from an XML string.
     * @param {string} rawXml - The raw XML string to parse.
     * @returns {PaymentStatusReport} A new PaymentStatusReport instance.
     */
    static fromXML(rawXml) {
        const parser = new fxp.XMLParser({ ignoreAttributes: false });
        const xml = parser.parse(rawXml);
        const customerPaymentStatusReport = xml.Document.CstmrPmtStsRpt;
        const rawCreationDate = customerPaymentStatusReport.GrpHdr.CreDtTm;
        const messageId = customerPaymentStatusReport.GrpHdr.MsgId;
        const creationDate = new Date(rawCreationDate);
        const initatingParty = parseParty(customerPaymentStatusReport.GrpHdr.InitgPty);
        const rawOriginalGroupInformation = customerPaymentStatusReport.OrgnlGrpInfAndSts;
        const originalGroupInformation = {
            originalMessageId: rawOriginalGroupInformation.OrgnlMsgId,
        };
        const rawPmtInfAndSts = customerPaymentStatusReport.OrgnlPmtInfAndSts;
        const pmtInfAndSts = Array.isArray(rawPmtInfAndSts)
            ? rawPmtInfAndSts
            : [rawPmtInfAndSts].filter(Boolean);
        // Find all TxnInfoAndSts
        const txnInfoAndSts = pmtInfAndSts
            .map(pmtInfAndSt => {
            // If there is no TxInfAndSts, return an empty array
            if (!pmtInfAndSt.hasOwnProperty('TxInfAndSts')) {
                return [];
            }
            // Otherwise, return the TxInfAndSts
            return Array.isArray(pmtInfAndSt.TxInfAndSts)
                ? pmtInfAndSt.TxInfAndSts
                : [pmtInfAndSt.TxInfAndSts];
        })
            .flat();
        const statusInformations = [
            parseGroupStatusInformation(customerPaymentStatusReport.OrgnlGrpInfAndSts),
            parsePaymentStatusInformations(pmtInfAndSts),
            parseTransactionStatusInformations(txnInfoAndSts),
        ]
            .flat()
            .filter(statusInformation => statusInformation !== null);
        return new PaymentStatusReport({
            messageId,
            creationDate,
            initatingParty,
            originalGroupInformation,
            statusInformations: statusInformations,
        });
    }
    /**
     * Gets the message ID of the Payment Status Report.
     * @returns {string} The message ID.
     */
    get messageId() {
        return this._messageId;
    }
    /**
     * Gets the creation date of the Payment Status Report.
     * @returns {Date} The creation date.
     */
    get creationDate() {
        return this._creationDate;
    }
    /**
     * Gets the initiating party of the Payment Status Report.
     * @returns {Party} The initiating party.
     */
    get initatingParty() {
        return this._initatingParty;
    }
    /**
     * Gets the original message ID from the original group information.
     * @returns {string} The original message ID.
     */
    get originalMessageId() {
        return this._originalGroupInformation.originalMessageId;
    }
    /**
     * Gets all status information entries in the Payment Status Report.
     * @returns {StatusInformation[]} An array of StatusInformation objects.
     */
    get statusInformations() {
        return this._statusInformations;
    }
    /**
     * Gets the first status information entry in the Payment Status Report.
     * @returns {StatusInformation} The first StatusInformation object in the statuses array.
     */
    get firstStatusInformation() {
        return this._statusInformations[0];
    }
    /**
     * Gets the original ID based on the type of the first status information.
     * @returns {string} The original ID, which could be the original message ID, payment ID, or end-to-end ID.
     */
    get originalId() {
        const firstStatusInformation = this
            .firstStatusInformation;
        switch (firstStatusInformation.type) {
            case 'group':
                return firstStatusInformation.originalMessageId;
            case 'payment':
                return firstStatusInformation.originalPaymentId;
            case 'transaction':
                return firstStatusInformation.originalEndToEndId;
        }
    }
    /**
     * Gets the status from the first status information entry.
     * @returns {PaymentStatus} The Status from the first status information.
     */
    get status() {
        return this.firstStatusInformation.status;
    }
}

/**
 * Represents a Cash Management End of Day Report (CAMT.053.x).
 * This class encapsulates the data and functionality related to processing
 * and accessing information from a CAMT.053 XML file.
 */
class CashManagementEndOfDayReport {
    _messageId;
    _creationDate;
    _recipient;
    _statements;
    constructor(config) {
        this._messageId = config.messageId;
        this._creationDate = config.creationDate;
        this._recipient = config.recipient;
        this._statements = config.statements;
    }
    static supportedMessages() {
        return [ISO20022Messages.CAMT_053];
    }
    get data() {
        return {
            messageId: this._messageId,
            creationDate: this._creationDate,
            recipient: this._recipient,
            statements: this._statements,
        };
    }
    static fromDocumentObject(obj) {
        const bankToCustomerStatement = obj.Document.BkToCstmrStmt;
        const rawCreationDate = bankToCustomerStatement.GrpHdr.CreDtTm;
        const creationDate = new Date(rawCreationDate);
        let statements = [];
        if (Array.isArray(bankToCustomerStatement.Stmt)) {
            statements = bankToCustomerStatement.Stmt.map((stmt) => parseStatement(stmt));
        }
        else {
            statements = [parseStatement(bankToCustomerStatement.Stmt)];
        }
        const rawRecipient = bankToCustomerStatement.GrpHdr.MsgRcpt;
        return new CashManagementEndOfDayReport({
            messageId: bankToCustomerStatement.GrpHdr.MsgId.toString(),
            creationDate,
            recipient: rawRecipient ? parseRecipient(rawRecipient) : undefined,
            statements: statements,
        });
    }
    /**
     * Creates a CashManagementEndOfDayReport instance from a raw XML string.
     *
     * @param {string} rawXml - The raw XML string containing the CAMT.053 data.
     * @returns {CashManagementEndOfDayReport} A new instance of CashManagementEndOfDayReport.
     * @throws {Error} If the XML parsing fails or required data is missing.
     */
    static fromXML(rawXml) {
        const parser = XML.getParser();
        const xml = parser.parse(rawXml);
        if (!xml.Document) {
            throw new InvalidXmlError("Invalid XML format");
        }
        const namespace = (xml.Document['@_xmlns'] || xml.Document['@_Xmlns']);
        if (!namespace.startsWith('urn:iso:std:iso:20022:tech:xsd:camt.053.001.')) {
            throw new InvalidXmlNamespaceError('Invalid CAMT.053 namespace');
        }
        return CashManagementEndOfDayReport.fromDocumentObject(xml);
    }
    /**
     *
     * @param json - JSON string representing a CashManagementEndOfDayReport
     * @returns {CashManagementEndOfDayReport} A new instance of CashManagementEndOfDayReport
     * @throws {Error} If the JSON parsing fails or required data is missing.
     */
    static fromJSON(json) {
        const obj = JSON.parse(json);
        if (!obj.Document) {
            throw new InvalidXmlError("Invalid JSON format");
        }
        return CashManagementEndOfDayReport.fromDocumentObject(obj);
    }
    toJSON() {
        const Document = {
            BkToCstmrStmt: {
                GrpHdr: {
                    MsgId: this._messageId,
                    CreDtTm: this._creationDate.toISOString(),
                    MsgRcpt: this._recipient ? exportRecipient(this._recipient) : undefined,
                },
                Stmt: this._statements.map((stmt) => exportStatement(stmt)),
            }
        };
        return { Document };
    }
    serialize() {
        const builder = XML.getBuilder();
        const obj = this.toJSON();
        obj.Document['@_xmlns'] = 'urn:iso:std:iso:20022:tech:xsd:camt.053.001.02';
        obj.Document['@_xmlns:xsi'] = 'http://www.w3.org/2001/XMLSchema-instance';
        return builder.build(obj);
    }
    /**
     * Retrieves all balances from all statements in the report.
     * @returns {Balance[]} An array of all balances across all statements.
     */
    get balances() {
        return this._statements.flatMap(statement => statement.balances);
    }
    /**
     * Retrieves all transactions from all statements in the report.
     * @returns {Transaction[]} An array of all transactions across all statements.
     */
    get transactions() {
        return this._statements
            .flatMap(statement => statement.entries)
            .flatMap(entry => entry.transactions);
    }
    /**
     * Retrieves all entries from all statements in the report.
     * @returns {Entry[]} An array of all entries across all statements.
     */
    get entries() {
        return this._statements.flatMap(statement => statement.entries);
    }
    /**
     * Gets the unique identifier for the message.
     * @returns {string} The message ID.
     */
    get messageId() {
        return this._messageId;
    }
    /**
     * Gets the party receiving the report.
     * @returns {Party | undefined} The recipient party information, or undefined if no recipient is set.
     */
    get recipient() {
        return this._recipient;
    }
    /**
     * Gets the date and time when the report was created.
     * @returns {Date} The creation date of the report.
     */
    get creationDate() {
        return this._creationDate;
    }
    /**
     * Gets all statements included in the report.
     * @returns {Statement[]} An array of all statements in the report.
     */
    get statements() {
        return this._statements;
    }
}
registerISO20022Implementation(CashManagementEndOfDayReport);

exports.ACHCreditPaymentInitiation = ACHCreditPaymentInitiation;
exports.ACHLocalInstrumentCode = ACHLocalInstrumentCode;
exports.ACHLocalInstrumentCodeDescriptionMap = ACHLocalInstrumentCodeDescriptionMap;
exports.BalanceTypeCode = BalanceTypeCode;
exports.BalanceTypeCodeDescriptionMap = BalanceTypeCodeDescriptionMap;
exports.CashManagementEndOfDayReport = CashManagementEndOfDayReport;
exports.ISO20022 = ISO20022;
exports.InvalidXmlError = InvalidXmlError;
exports.InvalidXmlNamespaceError = InvalidXmlNamespaceError;
exports.Iso20022JsError = Iso20022JsError;
exports.PaymentStatusCode = PaymentStatusCode;
exports.PaymentStatusReport = PaymentStatusReport;
exports.RTPCreditPaymentInitiation = RTPCreditPaymentInitiation;
exports.SEPACreditPaymentInitiation = SEPACreditPaymentInitiation;
exports.SWIFTCreditPaymentInitiation = SWIFTCreditPaymentInitiation;
