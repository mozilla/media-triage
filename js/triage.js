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
    2) additional settings options
*/

$(document).ready(function () {
  if (getTeam() == undefined) {
    window.location.href = window.location.href + "?year=2023&team=media"
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

  $.ajax({
    url: icsurl,
    crossDomain:true,
    crossOrigin: true,
    error: function (a, b, c) {
      console.log("ics file load error: " + c);
    },
    success: function(data) {
      // ICS DATA LOADED

      // Store ics data in our global data object. See
      // Notes.txt for format info.
      TriageData = parseICSData(data);

      let now = new Date();
      let currentYear = now.getFullYear();
      let year = getYear(now);
      let future = $.url().param('future');
      let displayType = (future ? "future" : (year == currentYear ? "current" : "past"));

      // Global that points to the buckets data for the display year.
      BugQueries = TriageData[year].data;

      // Generates Bugzilla query strings from ics data
      let count = setupQueryURLs(future);

      // Updates the page title.
      displayTitle(year, count, displayType);

      // Add engineer names, bucket dates, and grayed out '?' buckets.
      populateBuckets(year, count, displayType);

      // Display links for other years and the shedule
      displayYearFooter(currentYear, displayType, BugQueries);

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

  // Fire off a single bugzilla request per report
  url = TriageConfig.jsonConfig.BUGZILLA_REST_URL + TriageData['uburl'];
  if (key != null && key.length) {
    url += "&api_key=" + key;
  }

  // Limit what data we retreive for better performance.
  url += "&include_fields=" + TriageConfig.jsonConfig.include_fields;

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
    if (!("url" in query)) {
      continue;
    }

    let sfrom = query.from.split('-');
    let sto = query.to.split('-');

    // Calculate Bug Counts
    let count = 0;

    // Both to and from will be stored internally as UTC but will get converted to local
    // time when in use, so be careful.
    let from = new Date(Date.UTC(sfrom[0], parseInt(sfrom[1])-1, sfrom[2], 0, 0, 0, 0));
    let to = new Date(Date.UTC(sto[0], parseInt(sto[1])-1, sto[2], 0, 0, 0, 0));

    for (let idy = 0; idy < data.bugs.length; idy++) {
      let bug = data.bugs[idy];
      let changeTime = new Date(bug.last_change_time); // 2023-08-02T22:25:58Z
      let creationTime = new Date(bug.creation_time);
      if (creationTime.valueOf() >= from.valueOf() && creationTime.valueOf() <= to.valueOf()) { // UTC compare
        //console.log('fits:', bug.id, bug.summary, creationTime, changeTime);
        count++;
      }
    }
    query.bugcount = count;

    let now = new Date();
    let year = getYear(now);
    let id = year + "-" + idx;

    // This id was generated in insertEmptyBugLists
    displayCallback(div, idx, query.bugcount,
                    TriageConfig.jsonConfig.BUGZILLA_URL + query.url);

  }
}

// Add engineer names, bucket dates, and grayed out '?' buckets.
function populateBuckets(year, count, displayType) {
  if (!BugQueries) {
    return;
  }

  // Adds div placeholders for bucket entries. 
  insertEmptyBugLists(year, count, displayType);

  for (let i = 0; i < BugQueries.length; i++) {
    let query = BugQueries[i];

    if (!("url" in query)) {
      continue;
    }

    let dfrom = query.from.split('-');
    let dto = query.to.split('-');
    let id = year + "-" + i;

    let markup = "<div class=\"bugcount\"><div class='who'>"
      + query.who
      + "</div>"
      + "<div class='date'>("
      + MONTHS[dfrom[1]-1] + " " + dfrom[2] + " - "
      + MONTHS[dto[1]-1] + " " + dto[2] + ")</div>"
      + "<div id=\"data" + i + "\"" + " class=\"data greyedout\">?</div>"
      + "<div id=\"ubdata" + i + "\"" + " class=\"data greyedout\">?</div>"
      + "</div>";
    // This id was generated in insertEmptyBugLists
    $("#reportDiv" + id).replaceWith(markup);
  }
}

function insertEmptyBugLists(year, count, displayType) {
  let content = "";

  if (BugQueries) {
    for (let i = 0; i < count; i++) {
      let sfrom = BugQueries[i].from.split('-');
      let from = new Date(Date.UTC(sfrom[0], parseInt(sfrom[1])-1, sfrom[2], 0, 0, 0, 0));
      if (displayType != 'future' && from > Date.now())
        break;

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
        <div class="data"><a target="_buglist" href="https://bugzilla.mozilla.org/buglist.cgi?v2=2022-12-30&amp;v3=2023-1-6&amp;component=Graphics&amp;component=Graphics%3A%20Canvas2D&amp;component=Graphics%3A%20CanvasWebGL&amp;component=Graphics%3A%20Color%20Management&amp;component=Graphics%3A%20Image%20Blocking&amp;component=Graphics%3A%20ImageLib&amp;component=Graphics%3A%20Layers&amp;component=Graphics%3A%20Text&amp;component=Graphics%3A%20WebGPU&amp;component=Graphics%3A%20WebRender&amp;product=Core&amp;bug_status=UNCONFIRMED&amp;bug_status=NEW&amp;bug_status=ASSIGNED&amp;bug_status=REOPENED&amp;list_id=16022721&amp;keywords_type=nowords&amp;o3=changedafter&amp;f5=bug_severity&amp;keywords=meta&amp;o2=changedafter&amp;emailassigned_to1=1&amp;f6=bug_type&amp;n3=1&amp;email1=nobody%40mozilla.org&amp;f3=creation_ts&amp;o5=equals&amp;query_format=advanced&amp;v6=defect&amp;f1=OP&amp;f2=creation_ts&amp;f4=CP&amp;emailtype1=exact&amp;o6=equals&amp;v5=--">1</a><div class="data sub">B</div></div>
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

  html = "<div class='data'><a target='_buglist' href='" + searchUrl + "'>" + totalBugs + "</a><div class='data sub'>B</div></div>";

 $("#" + divId + divIndex).replaceWith(html);
}

// updatebot list
function updateBotList(divId, divIndex, totalBugs, searchUrl) {
  if (totalBugs == 0) {
    $("#ubdata" + divIndex).replaceWith("");
    return;
  }

  $("#ubdata" + divIndex).replaceWith("<div class='ubdata'><a target='_buglist' href=\"" + searchUrl
                                  + "\">" + totalBugs + "</a><div class='updata sub'>UB</div></div>" );
}

// displayType: future, current, past
function displayTitle(year, count, displayType) {
  let team = getTeam();

  let title = '';
  switch (team) {
    case 'graphics':
    title = "Graphics Team " + year + " Triage";
    break;
    case 'media':
    title = "Media Team " + year + " Triage";
    break;
    case 'webrtc':
    title = "Web Conferencing Team " + year + " Triage";
    break;
  }
  document.title = title;
  $("#title").text(title);

  $("#header-bg").attr("class", "header-bg header-bg-" + displayType);
  if (displayType != "current") {
    $("#title").attr("class", "title-light");
    $("#subtitle").attr("class", "subtitle title-light");
  }
}

function displayYearFooter(currentYear, displayType, icsBugQueries) {
  var footer = "<br><br><br><br><div id=\"footer\" class=\"footer-" + displayType + "\">";
  var nextYear = currentYear + 1;

  // If the ics file has dates for future years. Generally shouldn't show up unless you're
  // near the end of the year and the generation script ran into the new year.
  if (("" + nextYear) in icsBugQueries) {
    footer += "<a href=\"?year=" + (nextYear) + "&future=1&team=" + getTeam() + "\">" + (nextYear) + "</a> | ";
  }

  // The future schedule
  footer += "<a href=\"?year=" + currentYear + "&future=1&team=" + getTeam() + "\">Schedule</a> | ";

  let endYear = 2022;
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