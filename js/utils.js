/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function getYear(now) {
  var year = $.url().param('year');
  if (year) {
    if (parseInt(year)) {
      return year;
    }
  }
  return "" + now.getFullYear();
}

function getTeam() {
  return $.url().param('team');
}

function getDisplay() {
  var display = $.url().param('display');
  if (display && (display === BIG_SCREEN)) {
    return BIG_SCREEN;
  }
  return SMALL_SCREEN;
}

 function replaceUrlParam(url, paramName, paramValue) {
  if (paramValue == null) {
    paramValue = '';
  }
  var pattern = new RegExp('\\b(' + paramName + '=).*?(&|#|$)');
  if (url.search(pattern) >= 0) {
    return url.replace(pattern, '$1' + paramValue + '$2');
  }
  url = url.replace(/[?#]$/, '');
  return url + (url.indexOf('?') > 0 ? '&' : '?') + paramName + '=' + paramValue;
}

function teamSelectionChanged(el) {
  var team = el.options[el.selectedIndex].value;
  window.location.href = replaceUrlParam(window.location.href, 'team', team);
}

function getFromStorage(keyname) {
  let value = localStorage.getItem(keyname);
  if (value == null || !value.length) {
    console.log('session storage value for ', keyname, ' does not exist.');
    return null;
  }
  return value;
}

function clearStorage(keyname) {
  localStorage.removeItem(keyname);
}

function storeInStorage(keyname, value) {
  localStorage.setItem(keyname, value);
}

function getAPIKeyFromStorage() {
  return getFromStorage('apikey');
}

function getAPIKeyFromDialog() {
  return document.getElementById('api-key').value;
}

function trimAddress(account) {
  if (account == undefined) {
    // Unassigned
    account = '';
  }

  account = account.replace('nobody@mozilla.org', 'nobody');

  // aryx.bugmail@gmx-topmail.de
  account = account.replace('aryx.bugmail@gmx-topmail.de', 'Aryx');
  // ryanvm@gmail.com
  account = account.replace('ryanvm@gmail.com', 'RyanVM');
  // nagbot
  account = account.replace('release-mgmt-account-bot@mozilla.tld', 'nag-bot');
  // updatebot
  account = account.replace('update-bot@bmo.tld', 'update-bot');

  account = account.replace('@mozilla.org', '@moz');
  account = account.replace('@mozilla.com', '@moz');
  return account;
}

// Update libjxl to new version 5853ad97044c3b9da46d10b611e66063b1297cc5 from 2022-12-22 12:47:29
var RegExpSummaryPattern1 = new RegExp('Update (.*) to new version (.*) from (.*)');

// Update dav1d to new version ddbbfde for Firefox 91
var RegExpSummaryPattern2 = new RegExp('Update (.*) to new version (.*) for .*');

// Examine angle for 2 new commits, culminating in 92b793976c27682baaac6ea07f56d079b837876c (2021-10-12 23:36:02 +0000)
var RegExpSummaryPattern3 = new RegExp('Examine (.*) for [0-9]+ new commits, culminating in ([a-z0-9]+) ([0-9-]+)');

function parseBugSummary(bugid, summary, assignee, creation_time, resolution) {
  let data = {
    'rev': 'unknown',
    'date': new Date(creation_time),
    'lib': 'unknown',
    'id': bugid.toString(),
    'resolution': resolution,
    'assignee': trimAddress(assignee),
    summary: summary
  };

  // bleh
  summary = summary.replace('(', '');
  summary = summary.replace(')', '');

  let results = RegExpSummaryPattern1.exec(summary);
  if (results != null) {
    data.lib = results[1];
    data.rev = results[2];
    data.date = new Date(results[3]);
    return data;
  }

  results = RegExpSummaryPattern2.exec(summary);
  if (results != null) {
    data.lib = results[1];
    data.rev = results[2];
    return data;
  }

  results = RegExpSummaryPattern3.exec(summary);
  if (results != null) {
    data.lib = results[1];
    data.rev = results[2];
    data.date = new Date(results[3]);
    return data;
  }

  errorMsg('Error parsing bug', bugid, 'summary:');
  errorMsg(summary);
  return null;
}

function checkConfig() {
  let key = getAPIKeyFromStorage(); 
  if (key == null || !key.length) {
    document.getElementById('alert-icon').style.visibility = 'visible';
  } else {
    document.getElementById('alert-icon').style.visibility = 'hidden';
  }
}

function openSettings() {
  let dlg = document.getElementById("prompt-query-account");
  dlg.returnValue = "cancel";
  let key = getAPIKeyFromStorage(); 
  if (key != null && key.length) {
    document.getElementById('api-key').value = key;
  }
  dlg.addEventListener('close', (event) => {
    if (dlg.returnValue == 'confirm') {
      let key = getAPIKeyFromDialog();
      if (key != null) {
        // save and query
        storeInStorage('apikey', key);
        checkConfig();
      }
    } else {
    }
  }, { once: true });
  dlg.show();
}
