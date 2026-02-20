/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var BIG_SCREEN = "bigscreen";
var SMALL_SCREEN = "smallscreen";

var TriageData; // ICS Data
var BugQueries; // Queries database based on ICS data. Remove Me
var BugData; // Bug database covering all calendar dates
var UBData; // Bug database covering all calendar dates for ubdate bot
var TriageConfig;
var TotalQueries = 0;

// Not worth chasing toLocaleDateString etc. compatibility
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/*
  TODO:
     * additional settings options
*/

$(document).ready(function () {
  if (getTeam() == undefined) {
    window.location.href = window.location.href + "?year=2025&team=media"
    return;
  }
  $.getJSON('js/triage.json', function(data) {
    load(data);
  });
});

function load(jsonConfigData) {
  // Load ICS file
  loadSettingsInternal(jsonConfigData.triage);

  run();
}

function run() {
  let icsurl = '';
  switch (getTeam()) {
    case 'media':
      document.getElementById('team-select').selectedIndex = 0;
      icsurl = TriageConfig.jsonConfig.media_ics;
      break;
    case 'webrtc':
      document.getElementById('team-select').selectedIndex = 1;
      icsurl = TriageConfig.jsonConfig.webrtc_ics;
      break;
    case 'graphics':
      document.getElementById('team-select').selectedIndex = 2;
      icsurl = TriageConfig.jsonConfig.graphics_ics;
      break;
  }
  
  let random = Math.floor(Math.random() * 9e9);
  icsurl += '?rand=' + random;
  console.log("Loading [" + icsurl + "]");

  $.ajax({
    url: icsurl,
    crossDomain:true,
    crossOrigin: true,
    error: function (a, b, c) {
      console.log("ics file load error: " + c);
    },
    success: function(data) {
      // ICS DATA LOADED

      // Store ics data in our global data object.
      TriageData = parseICSData(data);

      //console.log(TriageData);

      let now = new Date();
      let currentYear = now.getFullYear();
      let year = getYear(now);

      // Global that points to the buckets data for the display year.
      BugQueries = TriageData[year].data;

      // Generates Bugzilla query strings from ics data
      let count = setupQueryURLs(true);

      // Updates the page title.
      displayTitle(year, count);

      // Add engineer names, bucket dates, and grayed out '?' buckets.
      populateBuckets(year, count);

      // Display links for other years and the shedule
      displayYearFooter(currentYear, BugQueries);

      // Make a single query for all bugs for both lists.
      loadBugListDetail();

    }
  });
}

function refreshList(event) {
  $("#errors").empty();
  $("#buglists").empty();
  $("#buglists").append("<div id='content'></div>");
  run();
}

function loadBugListDetail() {
  if (!BugQueries) {
    return;
  }

  $("#errors").empty();

  // Fire off a single bugzilla request per report
  let url = TriageConfig.jsonConfig.BUGZILLA_REST_URL + TriageData['url'];
  let key = getAPIKeyFromStorage(); 
  if (key != null && key.length) {
    url += "&api_key=" + key;
  }

  // Limit what data we retreive for better performance.
  url += "&include_fields=" + TriageConfig.jsonConfig.include_fields;

  $.ajax({
    url: url,
    crossDomain:true,
    dataType: 'json',
    ifModified: true,
    success: function(data, status) {
      if (status === 'success') {
        // Global
        BugData = data;
        displayBugLists(updateBugList, 'data', BugData);
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log("url:", url);
      console.log("status:", textStatus);
      console.log("error thrown:", errorThrown);
      console.log("response text:", jqXHR.responseText);
      try {
        let info = JSON.parse(jqXHR.responseText);
        let text = info.message ? info.message : errorThrown;
        console.log("detail:", text);
        errorMsg(text);
        return;
      } catch(e) {
      }
    }
  });

  // Fire off a bugzilla request
  url = TriageConfig.jsonConfig.BUGZILLA_REST_URL + TriageData['uburl'];
  if (key != null && key.length) {
    url += "&api_key=" + key;
  }

  // Limit what data we retreive for better bugzilla query performance.
  url += "&" + TriageConfig.jsonConfig.include_fields;

  console.log(TriageConfig.jsonConfig.BUGZILLA_URL + TriageData['uburl']);

  $.ajax({
    url: url,
    crossDomain:true,
    dataType: 'json',
    ifModified: true,
    success: function(data, status) {
      if (status === 'success') {
        UBData = data;
        displayBugLists(updateBotList, 'ubdata', UBData);
      }
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log("url:", url);
      console.log("status:", textStatus);
      console.log("error thrown:", errorThrown);
      console.log("response text:", jqXHR.responseText);
      try {
        let info = JSON.parse(jqXHR.responseText);
        let text = info.message ? info.message : errorThrown;
        console.log("detail:", text);
        errorMsg(text);
        return;
      } catch(e) {
      }
    }
  });

}

var LastErrorText = "";
function errorMsg(text) {
  if (LastErrorText == text)
    return;
  $("#errors").append(text);
  LastErrorText = text;
}

function displayBugLists(displayCallback, div, data) {
  for (let idx = 0; idx < BugQueries.length; idx++) {
    let query = BugQueries[idx];
    let qurl = '';
    if (div == 'ubdata') {
      if (!("uburl" in query)) {
        continue;
      }
      qurl = query.uburl;
    } else {
      if (!("url" in query)) {
        continue;
      }
      qurl = query.url;
    }

    // Same dates we display in html
    let sfrom = query.from.split('-');
    let sto = query.to.split('-');

    // Calculate Bug Counts
    let count = 0;

    // Both to and from will be stored internally as UTC but will get converted to local
    // time when in use, so be careful.

    // Date.UTC(year, monthIndex, day, hour, minute, second, millisecond)
    let from = new Date(Date.UTC(sfrom[0], parseInt(sfrom[1])-1, sfrom[2], 0, 0, 0, 0));
    let to;

    // If the ICS start and end dates span 8 days, use this for accurate bug counts.
    to = new Date(Date.UTC(sto[0], parseInt(sto[1])-1, sto[2], 0, 0, 0, 0));

    // If the ICS start and end dates span 7 days, use this for accurate bug counts.
    //to = new Date(Date.UTC(sto[0], parseInt(sto[1])-1, sto[2], 23, 59, 59, 0));

    //console.log(query.who);
    //console.log('from='+from.toUTCString());
    //console.log('to='+to.toUTCString());

    for (let idy = 0; idy < data.bugs.length; idy++) {
      let bug = data.bugs[idy];

      // a lot of the time this isn't populated, resulting in an invalid date
      //let changeTime = new Date(bug.last_change_time); // 2023-08-02T22:25:58Z
      //console.log('change date:' + bug.last_change_time);

      let creationTime = new Date(bug.creation_time);
      //console.log('bug creation time:' + bug.creation_time);
      if (creationTime.valueOf() >= from.valueOf() && creationTime.valueOf() <= to.valueOf()) { // UTC compare
        //console.log('fits:', bug.id, bug.summary, creationTime);
        count++;
      } else {
        //console.log('no fit:', bug.id, bug.summary);
        //console.log(creationTime.valueOf(), from.valueOf(), to.valueOf())
      }
    }
    query.bugcount = count;

    let now = new Date();
    let year = getYear(now);
    let id = year + "-" + idx;

    // This id was generated in insertEmptyBugLists
    displayCallback(div, idx, query.bugcount,
                    TriageConfig.jsonConfig.BUGZILLA_URL + qurl);

  }
}

// Add engineer names, bucket dates, and grayed out '?' buckets.
function populateBuckets(year, count) {
  if (!BugQueries) {
    return;
  }

  // Adds div placeholders for bucket entries. 
  insertEmptyBugLists(year, count);

  for (let i = 0; i < BugQueries.length; i++) {
    let query = BugQueries[i];

    if (!("url" in query)) {
      continue;
    }

    let dfrom = query.from.split('-');
    let dto = query.to.split('-');
    let id = year + "-" + i;

    // Gray future buckets
    let now = new Date();
    let endDate = new Date(dfrom[0], parseInt(dfrom[1])-1, dfrom[2], 0, 0, 0, 0);
    let cssTag = 'greyedout';
    if (now > endDate) {
      cssTag = '';
    }

    let markup = "<div class='bugcount'><div class='who " + cssTag + "'>"
      + query.who
      + "</div>"
      + "<div class='date " + cssTag + "'>("
      + MONTHS[dfrom[1]-1] + " " + dfrom[2] + " - "
      + MONTHS[dto[1]-1] + " " + dto[2] + ")</div>"
      + "<div id='data" + i + "'" + " class='data greyedout'>?</div>"
      + "<div id='ubdata" + i + "'" + " class='data greyedout'>?</div>"
      + "</div>";
    // This id was generated in insertEmptyBugLists
    $("#reportDiv" + id).replaceWith(markup);
  }
}

function insertEmptyBugLists(year, count) {
  let content = "";

  if (BugQueries) {
    for (let i = 0; i < count; i++) {
      let sfrom = BugQueries[i].from.split('-');
      let from = new Date(Date.UTC(sfrom[0], parseInt(sfrom[1])-1, sfrom[2], 0, 0, 0, 0));
      content += "<div class='bugcount' id='reportDiv" + year + "-" + i + "'></div>";
    }
    $("#content").replaceWith(content);
  }
}

/*
  <div id="buglists" style="opacity: 1;">
      <div class="bugcount">
        <div class="who">Kelsey Gilbert</div>
        <div class="date">(Dec 30 - Jan 6)</div>
        <div class="data"><a target="_buglist" href="https://bug...">1</a><div class="data sub">B</div></div>
      </div>
      ...
  </div>
*/

// bug list
function updateBugList(divId, divIndex, totalBugs, searchUrl) {
  let html = '';
  if (totalBugs == 0) {
    html = "<div class='data'><a target='_buglist' href='" + searchUrl + "'>&nbsp;</a></div>";
    $("#data" + divIndex).replaceWith(html);
    return;
  }

  html = "<div class='data'><a target='_buglist' href='" + searchUrl + "'>" + totalBugs + "</a><div class='data sub'><abbr title=\"Bug(s) in Bugzilla with no `Severity` set\">B</abbr></div></div>";
  $("#" + divId + divIndex).replaceWith(html);
}

// updatebot list
function updateBotList(divId, divIndex, totalBugs, searchUrl) {
  if (totalBugs == 0) {
    $("#ubdata" + divIndex).replaceWith("");
    return;
  }

  $("#ubdata" + divIndex).replaceWith("<div class='ubdata'><a target='_buglist' href=\"" + searchUrl
                                  + "\">" + totalBugs + "</a><div class='updata sub'><abbr title=\"UpdateBot bug(s) in Bugzilla with no `Severity` set\">UB</abbr></div></div>" );
}

function displayTitle(year, count) {
  let team = getTeam();

  $(".team-title").hide();
  let $el = $("#title-" + team);
  $el.find(".title-year").text(year);
  $el.show();
  document.title = $el.text();
}


function displayYearFooter(currentYear, icsBugQueries) {
  var footer = "<div id=\'footer\' class=\'footer\'>";
  var nextYear = currentYear + 1;

  // The future schedule
  footer += "<a href=\'?year=" + nextYear + "&team=" + getTeam() + "\'>" + nextYear + "</a> | ";

  let endYear = 2023;
  for (var year = currentYear; year >= endYear; year--) {
    footer += "<a href=\"?year=" + year + "&team=" + getTeam() + "\">" + year + "</a>";
    if (year != endYear) {
      footer += ' | ';
    }
  }
  footer += "</div>";
  $("#body").append(footer);
}

// Progress for queries
function cb_initProgress() {
  document.getElementById('progressmeter').max = TotalQueries;
  document.getElementById('progressmeter').value = 0;
  document.getElementById('progress').style.visibility = 'visible';
  console.log('TotalQueries', TotalQueries);
}

function cb_stepdownProgress() {
  document.getElementById('progressmeter').value += 1;
  closeProgress();
}

function cb_closeProgress() {
  if (document.getElementById('progressmeter').value >= TotalQueries)
    document.getElementById('progress').style.visibility = 'hidden';
}

function onSettingsOpened() {
  $("#buglists").css('opacity', '0.5');
  $("#announcement").css('opacity', '0.5');
}

function onSettingsClosed() {
  $("#buglists").css('opacity', '1.0');
  $("#announcement").css('opacity', '1.0');
}
