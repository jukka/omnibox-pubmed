// Copyright 2012 Jukka Zitting
// Apache License, Version 2.0 - see the end of this file

var pubmed = 'http://www.ncbi.nlm.nih.gov/pubmed/';
var eutils = 'http://eutils.ncbi.nlm.nih.gov/entrez/eutils';
var esearch = eutils + '/esearch.fcgi';
var esummary = eutils + '/esummary.fcgi';
var toolid = '&tool=omnibox-jira&email=jukka.zitting@gmail.com';

function evaluateXPath(xml, expression, type) {
    var doc = xml;
    if (xml.nodeType == Node.ELEMENT_NODE) {
        doc = xml.ownerDocument;
    }
    return doc.evaluate(expression, xml, null, type, null);
}

function getStringByXPath(xml, expression) {
    var type = XPathResult.STRING_TYPE;
    var result = evaluateXPath(xml, expression, type);
    return result.stringValue;
}

function getListByXPath(xml, expression) {
    var list = [];
    var type = XPathResult.ORDERED_NODE_ITERATOR_TYPE;
    var iterator = evaluateXPath(xml, expression, type);
    var node = iterator.iterateNext();
    while (node) {
        list.push(node.textContent);
        node = iterator.iterateNext();
    }
    return list;
}

function escape(text) {
    text = text.replace(/&/g, "&amp;");
    text = text.replace(/</g, "&lt;");
    text = text.replace(/>/g, "&gt;");
    return text;
}

function createSuggestion(docsum) {
    var d;

    var authors = getListByXPath(docsum, "./Item/Item[@Name='Author']");
    if (authors.length > 3) {
        d = escape(authors[0]) + ' et al.';
    } else if (authors.length === 3) {
        d = escape(authors[0] + ', ' + authors[1] + ' and ' + authors[2]);
    } else if (authors.length === 2) {
        d = escape(authors[0] + ' and ' + authors[1]);
    } else if (authors.length === 1) {
        d = escape(authors[0]);
    } else {
        d = 'Unknown Author(s)';
    }

    var so = getStringByXPath(docsum, "./Item[@Name='SO']");
    var year = /^([0-9]{4})/.exec(so);
    if (year) {
        d = d + ', ' + year[0];
    }

    var title = getStringByXPath(docsum, "./Item[@Name='Title']");
    d = d.replace(/\.*\s*$/, '.');
    d = d + ' <match>' + escape(title.replace(/\.*\s*$/, '.')) + '</match>';

    var source = getStringByXPath(docsum, "./Item[@Name='FullJournalName']");
    if (!source) {
        source = getStringByXPath(docsum, "./Item[@Name='Source']");
    }
    if (source) {
        d = d + ' ' + escape(source);
        if (so) {
            d = d + ' ' + escape(so);
        }
    }

    var id = getStringByXPath(docsum, './Id');
    return { 'content': pubmed + id, 'description': d };
}

function processSummaryResponse(xml, suggest) {
    var suggestions = [];
    var docsums = xml.getElementsByTagName('DocSum');
    for (var i = 0; i < docsums.length; i++) {
        try {
        suggestions.push(createSuggestion(docsums[i]));
        } catch (e) {
        alert(e);
        }
    }
    suggest(suggestions);
}

function processSearchResponse(xml, suggest) {
    var count = getStringByXPath(xml, '/eSearchResult/Count');
    if (count == 0) {
        count = 'no results';
    } else if (count == 1) {
        count = 'one result';
    } else {
        count = count + ' results';
    }

    var translation = getStringByXPath(xml, '/eSearchResult/QueryTranslation');
    var description =
        '<match>%s</match> - ' + count
        + ' - <dim>' + escape(translation) + '</dim>';
    chrome.omnibox.setDefaultSuggestion({ 'description': description });

    var ids = getListByXPath(xml, '/eSearchResult/IdList/Id');
    if (ids.length > 0) {
        var url = esummary + '?db=pubmed&id=';
        for (var i = 0; i < ids.length; i++) {
            if (i > 0) {
                url = url + ',';
            }
            url = url + encodeURIComponent(ids[i]);
        }

        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
            processSummaryResponse(this.responseXML, suggest);
        };
        xhr.open('GET', url + toolid, true);
        xhr.send();
    }
}

chrome.omnibox.setDefaultSuggestion({ 'description': '<match>%s</match>' });

chrome.omnibox.onInputChanged.addListener(function(text, suggest) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        processSearchResponse(this.responseXML, suggest);
    };
    var term = encodeURIComponent(text);
    xhr.open('GET', esearch + '?retmax=5&term=' + term + toolid, true);
    xhr.send();
});


chrome.omnibox.onInputEntered.addListener(function(text) {
    var url = text;
    if (text.lastIndexOf(pubmed, 0) != 0) {
        var term = encodeURIComponent(text);
        url = pubmed + '?term=' + term;
    }
    chrome.tabs.update({ 'url': url });
});

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
