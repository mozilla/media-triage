/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

 var SettingsLoaded = false;

 var TriageConfig = {
  jsonConfig: null,
  persistStorage: true,
  apiKey: null,
  lastTeamOrIndividual: null,
  useSameTarget: true,

  listConfig: {
    filter_mynis: false,
    filter_allnis: false
  }
};

/*
 * Basic Utility Finctions
 */

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
  TriageConfig.lastTeamOrIndividual = $.url().param('team');
  storeInStorage('lastTeamOrIndividual', TriageConfig.lastTeamOrIndividual);
  return TriageConfig.lastTeamOrIndividual;
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

function updateApiKeyIcon() {
  let key = getAPIKeyFromStorage();
  if (key == null || !key.length) {
    document.getElementById('alert-icon').style.visibility = 'visible';
  } else {
    document.getElementById('alert-icon').style.visibility = 'hidden';
  }
}

/*
 * Parsing functions
 */

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

function dateToBz(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/*
 * Returns a data structure containing all of the ics entries,
 * names, dates, and some general stats in the root object. 
 */
function parseICSData(icsdata) {
  let triageData = {};

  // Download calendar and parse into bugqueries.
  let ics = ical.parseICS(icsdata);

  let years = [];

  let maxDate = null, minDate = null;

  for (let k in ics) {
    if (!ics.hasOwnProperty(k)) {
      console.log('no Own Property', k)
    }

    if (ics[k].type != 'VEVENT') {
      console.log('Not a VEVENT', ics[k])
      continue;
    }

    var ev = ics[k];

    //console.log(ev.summary, ev.location, ev.start.getDate(), MONTHS[ev.start.getMonth()], ev.start.getFullYear());

    // Filter entries based on team name:
    // teams - webrtc, media, graphics
    let team = getTeam()
    let summary = ev.summary.toLowerCase()

    if (team == 'webrtc' && summary.indexOf('webrtc') == -1) {
        continue;
    }
    if (team == 'media' &&
        (summary.indexOf('playback') == -1 && summary.indexOf('media') == -1)
       ) {
        continue;
    }

    var who = ev.summary;
    var startDate = dateToBz(ev.start);
    var endDate = dateToBz(ev.end);
    var year = `${ev.start.getFullYear()}`;
    var endyear = `${ev.end.getFullYear()}`;

    if (parseInt(year) < 2022) {
      continue;
    }
    years.push(year);

    if (maxDate < ev.end || maxDate == null)
      maxDate = ev.end;
    if (minDate > ev.start || minDate == null)
      minDate = ev.start;

    // Cleanup summaries a bit
    who = who.replace('webrtc triage', '');
    who = who.replace('playback triage', '');
    who = who.replace('[Incoming Triage] ', '');
    who = who.replace('WebRTC Triage', '');
    who = who.replace('Media Triage', '');

    //console.log('parseICS event:', '"' + who + '"', startDate, endDate, notAfterBz, year, endyear);

    if (!triageData[year]) {
      triageData[year] = {
        data: [],
        search: '',
        updayebot: ''
      }
    }

    if (!triageData[endyear]) {
      triageData[endyear] = {
        data: [],
        search: '',
        updayebot: ''
      }
    }

    const query = {
      who: who,
      from: startDate,
      to: endDate
    };
    triageData[year].data.push(query);
    if (year != endyear) {
      triageData[endyear].data.push(query);
    }
  }

  triageData['min'] = dateToBz(minDate);
  triageData['max'] = dateToBz(maxDate);

  //console.log(triageData.min, triageData.max);

  // Sort
  years.forEach(function (date) {
    triageData[date].data.sort(
      function(a, b){
         return new Date(a.from) > new Date(b.from);
      });
  });

  return triageData;
}

function setupQueryURLs(displayFuture) {
  if (!BugQueries) {
    console.log("no bug queries found.")
    return 0;
  }

  let components;
  switch (getTeam()) {
    case 'graphics':
      components = TriageConfig.jsonConfig.graphics_components;
      break;
    case 'media':
      components = TriageConfig.jsonConfig.media_components;
      break;
    case 'webrtc':
      components = TriageConfig.jsonConfig.webrtc_components;
      break;
  }

  // Do not show results for dates that are too close to today.  Only once we
  // are five days after the end of the term...
  var cutoff = new Date();
  for (var i = 0; i < BugQueries.length; i++) {
    // If this is the schedule, display all queries for the year, otherwise filter
    // out future queries.
    if (!displayFuture) {
      var dto = new Date(BugQueries[i].from);
      if (cutoff < dto) {
        continue;
      }
    }

    let search_params = "?";
    let ubsearch = "?"
    TriageConfig.jsonConfig.generic_bugzilla_search_template.forEach(function (entry) {
      search_params += entry + "&";
      ubsearch += entry + "&";
    });
    
    TriageConfig.jsonConfig.additional_bugzilla_search_params.forEach(function (entry) {
      search_params += entry + "&";
    });

    TriageConfig.jsonConfig.additional_updatebot_search_params.forEach(function (entry) {
      ubsearch += entry + "&";
    });

    //TriageConfig.jsonConfig.filtermynis_search_params.forEach(function (entry) {
    //  search_params += entry + "&";
    //});

    // Bugzilla searches exclude start date, include end date.
    search_params = search_params.replace(/<COMPONENT>/g, components);
    search_params = search_params.replace(/<AFTER>/g, BugQueries[i].from).replace(/<NOT-AFTER>/g, BugQueries[i].to);
    BugQueries[i]["url"] = search_params;

    // Bugzilla updatebot searches
    ubsearch = ubsearch.replace(/<COMPONENT>/g, components);
    ubsearch = ubsearch.replace(/<AFTER>/g, BugQueries[i].from).replace(/<NOT-AFTER>/g, BugQueries[i].to);
    BugQueries[i]["uburl"] = ubsearch;
  }

  // Global searches
  let search_params = "?";
  let ubsearch = "?"
  TriageConfig.jsonConfig.generic_bugzilla_search_template.forEach(function (entry) {
    search_params += entry + "&";
    ubsearch += entry + "&";
  });
    
  TriageConfig.jsonConfig.additional_bugzilla_search_params.forEach(function (entry) {
    search_params += entry + "&";
  });

  TriageConfig.jsonConfig.additional_updatebot_search_params.forEach(function (entry) {
    ubsearch += entry + "&";
  });

  //TriageConfig.jsonConfig.filtermynis_search_params.forEach(function (entry) {
  //  search_params += entry + "&";
  //});

  // Bugzilla searches
  search_params = search_params.replace(/<COMPONENT>/g, components);
  search_params = search_params.replace('<AFTER>', TriageData.min).replace('<NOT-AFTER>', TriageData.max);
  TriageData["url"] = search_params;

  // Bugzilla updatebot searches
  ubsearch = ubsearch.replace(/<COMPONENT>/g, components);
  ubsearch = ubsearch.replace(/<AFTER>/g, TriageData.min).replace(/<NOT-AFTER>/g, TriageData.max);
  TriageData["uburl"] = ubsearch;

  // console.log(ubsearch);

  return BugQueries.length;
}

/*
 * Storage utilities
 */

function localStorageItemExists(keyname) {
  let value = localStorage.getItem(keyname);
  return !(value == null || !value.length);
}

function getFromStorage(keyname) {
  let st = useLocalStore() ? localStorage : sessionStorage;
  let value = st.getItem(keyname);
  if (value == null || !value.length) {
    console.log("session storage value for '" + keyname + "' does not exist.");
    return null;
  }
  return value;
}

function clearStorage(keyname) {
  localStorage.removeItem(keyname);
  sessionStorage.removeItem(keyname);
}

function storeInStorage(keyname, value) {
  AssertSettings();
  let st = useLocalStore() ? localStorage : sessionStorage;
  st.setItem(keyname, value);
}

function getAPIKeyFromStorage() {
  return getFromStorage('apiKey');
}

function AssertSettings() {
  if (!SettingsLoaded) console.log("Assert: settings used before being loaded.")
}

function useLocalStore() {
  AssertSettings();
  return TriageConfig.persistStorage;
}

/*
 * Settings panel processing
 */

/*
 var TriageConfig = {
  jsonConfig: '', // json config file data
  persistStorage: true,
  apiKey: null,
  lastTeamOrIndividual: null,
  useSameTarget: true,

  listConfig: {
    filter_mynis: false,
    filter_allnis: false
  }
};
*/

// Load TriageConfig with persisted data from session store, or
// populate with default values.
function loadSettingsInternal(jsonConfig) {
  console.log('loading settings...');
  SettingsLoaded = true;

  TriageConfig.jsonConfig = jsonConfig;

  if (!localStorageItemExists('persistStorage')) {
    TriageConfig.persistStorage = true;
    TriageConfig.useSameTarget = true;
    TriageConfig.listConfig.filter_mynis = false;
    TriageConfig.listConfig.filter_allnis = false;
    return;
  }

  TriageConfig.persistStorage = getFromStorage("persistStorage") == (null || 'false') ? false : true;

  if (getFromStorage("lastTeamOrIndividual") == null) {
    TriageConfig.lastTeamOrIndividual = 'media';
  } else {
    TriageConfig.lastTeamOrIndividual = getFromStorage("lastTeamOrIndividual");
  }

  TriageConfig.apiKey = (getAPIKeyFromStorage() == null) ? "" : getAPIKeyFromStorage();
  TriageConfig.useSameTarget = getFromStorage("useSameTarget");
  TriageConfig.listConfig.filter_mynis = getFromStorage("filter_mynis") == (null || 'false') ? false : true;
  TriageConfig.listConfig.filter_allnis = getFromStorage("filter_allnis") == (null || 'false') ? false : true;

  console.log('config:', TriageConfig);
}

function openSettingsPanel() {
  AssertSettings();

  let dlg = document.getElementById("prompt-query-account");
  dlg.returnValue = "cancel";

  if (TriageConfig.apiKey != null) {
    document.getElementById('api-key').value = TriageConfig.apiKey;
  }
  //document.getElementById("option-filter_allnis").checked = TriageConfig.listConfig.filter_allnis;
  //document.getElementById("option-filter_mynis").checked = TriageConfig.listConfig.filter_mynis;
  //document.getElementById("option-targets").checked = TriageConfig.useSameTarget;
  document.getElementById("option-save").checked = TriageConfig.persistStorage;

  dlg.addEventListener('close', (event) => {
    if (onSettingsClosed != undefined) {
      onSettingsClosed();
    }

    if (dlg.returnValue == 'confirm') {
      saveSettingsInternal();
    }
  }, { once: true });

  if (onSettingsOpened != undefined) {
    onSettingsOpened();
  }
  dlg.show();
}

function getDlgValue(id) {
  return document.getElementById(id).value;
}

function getDlgToggleState(id) {
  return document.getElementById(id).checked;
}

// Extract values from settings dialog and poulate TriageConfig. Also
// save data in persisted or local storage.
function saveSettingsInternal() {
  AssertSettings();

  TriageConfig.persistStorage = getDlgValue('option-save') == (null || 'false') ? false : true;

  TriageConfig.apiKey = getDlgValue('api-key');
  //TriageConfig.listConfig.filter_allnis = getDlgToggleState('option-filter_allnis');
  //TriageConfig.listConfig.filter_mynis = getDlgToggleState('option-filter_mynis');
  //TriageConfig.useSameTarget = getDlgToggleState('option-targets');

  //storeInStorage('useSameTarget', TriageConfig.useSameTarget);
  storeInStorage('apiKey', TriageConfig.apiKey);
  storeInStorage('persistStorage', TriageConfig.persistStorage);
  //storeInStorage('filter_allnis', TriageConfig.listConfig.filter_allnis);
  //storeInStorage('filter_mynis', TriageConfig.listConfig.filter_mynis);

  updateApiKeyIcon();
}
/*
  <div class="settings-col1">
    <input type="checkbox" id="option-filter_allnis" name="target" />
  </div>
  <div class="settings-col2">
    <div class="settings-label">
      Filter bugs that have pending personal need info flags set (ni's set by people vs. bots).
    </div>
  </div>
  <div class="settings-col1">
    <input type="checkbox" id="option-filter_mynis" name="target" />
  </div>
  <div class="settings-col2">
    <div class="settings-label">
      Filter bugs that currently have a need info set by you.
    </div>
  </div>
*/


/*
 * Event handlers
 */

function teamSelectionChanged(el) {
  var team = el.options[el.selectedIndex].value;
  window.location.href = replaceUrlParam(window.location.href, 'team', team);
}

