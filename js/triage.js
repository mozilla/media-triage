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
var DisplayedBugs = []; // Bugs currently visible on the dashboard
var TriageConfig;
var TotalQueries = 0;

var AutoRefreshTimer = null;        // handle for the 10-minute refresh interval
var NotificationsEnabled = false;   // true when user has opted in to change notifications
var BugCountSnapshot = [];          // per-slot count snapshot captured before each silent refresh

// Not worth chasing toLocaleDateString etc. compatibility
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

$(document).ready(function () {
  if (getTeam() == undefined) {
    window.location.href = window.location.href + "?year=2026&team=media"
    return;
  }

  // Restore notification opt-in state if the user already granted permission.
  if ('Notification' in window && Notification.permission === 'granted') {
    NotificationsEnabled = true;
    let btn = document.getElementById('notify-button');
    if (btn) {
      btn.textContent = 'Cancel Notifications';
      btn.classList.add('notify-active');
    }
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

      // Display links for other years - doesn't depend on triage data
      displayYearFooter(currentYear, parseInt(year, 10));

      // Global that points to the buckets data for the display year.
      BugQueries = TriageData[year].data;

      // Generates Bugzilla query strings from ics data
      let count = setupQueryURLs(true);

      // Updates the page title.
      displayTitle(year, count);

      // Add engineer names, bucket dates, and grayed out '?' buckets.
      populateBuckets(year, count);

      // Reset and disable IFL until bugs are counted.
      DisplayedBugs = [];
      $('.lucky-button').prop('disabled', true);

      // Make a single query for all bugs for both lists.
      loadBugListDetail();

      // Start the 10-minute silent refresh cycle.
      startAutoRefresh();

    }
  });
}

function refreshList(event) {
  $("#errors").empty();
  $(".dev-bug-list").remove();
  $("#stats").empty();
  BugData = null;
  UBData = null;
  run();
  // run() will call startAutoRefresh() after ICS loads, resetting the interval
  // from zero so a manual refresh doesn't get immediately followed by an auto one.
}

function startAutoRefresh() {
  if (AutoRefreshTimer) {
    clearInterval(AutoRefreshTimer);
  }
  AutoRefreshTimer = setInterval(silentBugRefresh, 10 * 60 * 1000);
}

function silentBugRefresh() {
  if (!BugQueries) {
    return;
  }
  let snapshot = snapshotCounts();
  loadBugListDetail(function() {
    refreshBucketStyles();
    if (NotificationsEnabled) {
      diffAndNotify(snapshot);
    }
  });
}

// Re-evaluate each bucket's future/current state and update .who/.date gray styling.
// Called after silent refreshes so buckets that transition to "current" on Saturday
// are un-grayed without requiring a full page reload.
function refreshBucketStyles() {
  if (!BugQueries) return;
  let now = new Date();
  for (let i = 0; i < BugQueries.length; i++) {
    let query = BugQueries[i];
    if (!("url" in query)) continue;
    let dfrom = query.from.split('-');
    let startDate = new Date(dfrom[0], parseInt(dfrom[1])-1, dfrom[2], 0, 0, 0, 0);
    let isFuture = !(now > startDate);
    let $bucket = $('.dev-bug-list').eq(i);
    $bucket.find('.who').toggleClass('gray-text', isFuture);
    $bucket.find('.date').toggleClass('gray-text', isFuture);
  }
}

// Capture current per-slot counts before a silent refresh.
function snapshotCounts() {
  if (!BugQueries) {
    return [];
  }
  return BugQueries.map(function(q) {
    return {
      bugcount: q.bugcount || 0,
      seccount: q.seccount || 0,
      ubcount:  q.ubcount  || 0,
      who:  q.who,
      from: q.from
    };
  });
}

// Compare a pre-refresh snapshot against current counts and fire a single
// bundled notification listing every slot that changed.
function diffAndNotify(snapshot) {
  if (!BugQueries || !snapshot || snapshot.length === 0) {
    return;
  }

  let lines = [];
  for (let i = 0; i < snapshot.length && i < BugQueries.length; i++) {
    let old = snapshot[i];
    let cur = BugQueries[i];
    let parts = [];

    let bugDelta = (cur.bugcount || 0) - old.bugcount;
    let secDelta = (cur.seccount || 0) - old.seccount;
    let ubDelta  = (cur.ubcount  || 0) - old.ubcount;

    if (bugDelta !== 0) {
      parts.push((bugDelta > 0 ? '+' : '') + bugDelta + ' bug' + (Math.abs(bugDelta) !== 1 ? 's' : ''));
    }
    if (secDelta !== 0) {
      parts.push((secDelta > 0 ? '+' : '') + secDelta + ' security bug' + (Math.abs(secDelta) !== 1 ? 's' : ''));
    }
    if (ubDelta !== 0) {
      parts.push((ubDelta > 0 ? '+' : '') + ubDelta + ' updatebot bug' + (Math.abs(ubDelta) !== 1 ? 's' : ''));
    }

    if (parts.length > 0) {
      let sfrom = old.from.split('-');
      let monthStr = MONTHS[parseInt(sfrom[1], 10) - 1] + ' ' + sfrom[2];
      lines.push(old.who + ' (' + monthStr + '): ' + parts.join(', '));
    }
  }

  if (lines.length === 0) {
    console.log("[notify] diffAndNotify: no changes detected, skipping notification.");
    return;
  }

  console.log("[notify] Firing notification with", lines.length, "changed slot(s):");
  lines.forEach(function(line) { console.log("[notify]  ", line); });

  let n = new Notification('Triage Dashboard Updated', {
    body: lines.join('\n'),
    tag:  'triage-refresh',
    icon: 'images/triagefavicon.png'
  });
  n.onerror = function(e) { console.log("[notify] Notification error:", e); };
  n.onshow  = function()  { console.log("[notify] Notification displayed successfully."); };
}

// Toggle notifications on/off, requesting permission if needed.
function toggleNotifications() {
  let btn = document.getElementById('notify-button');

  if (NotificationsEnabled) {
    NotificationsEnabled = false;
    btn.textContent = 'Notify Me';
    btn.classList.remove('notify-active');
    return;
  }

  if (!('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    NotificationsEnabled = true;
    btn.textContent = 'Cancel Notifications';
    btn.classList.add('notify-active');
  } else if (Notification.permission === 'denied') {
    // Can't prompt again — show a brief inline hint near the button.
    let hint = document.getElementById('notify-hint');
    hint.textContent = 'Notifications blocked — check browser settings.';
    hint.style.display = 'inline';
    setTimeout(function() { hint.style.display = 'none'; }, 4000);
  } else {
    Notification.requestPermission().then(function(permission) {
      if (permission === 'granted') {
        NotificationsEnabled = true;
        btn.textContent = 'Cancel Notifications';
        btn.classList.add('notify-active');
      }
    });
  }
}

function updateStats() {
  let bugTotal = BugData ? BugData.bugs.length : 0;
  let ubTotal  = UBData  ? UBData.bugs.length  : 0;
  let bugUrl = TriageConfig.jsonConfig.BUGZILLA_URL + TriageData['url'];
  let ubUrl  = TriageConfig.jsonConfig.BUGZILLA_URL + TriageData['uburl'];

  let $stats = $('#stats').empty();
  $stats.append($('<a>').attr({ href: bugUrl, target: '_buglist' })
                        .text(bugTotal + ' open bug' + (bugTotal !== 1 ? 's' : '')));
  $stats.append(' \u2022 ');
  $stats.append($('<a>').addClass('ub-stat').attr({ href: ubUrl, target: '_buglist' })
                        .text(ubTotal + ' open update bot bug' + (ubTotal !== 1 ? 's' : '')));
}

function feelingLucky() {
  if (!DisplayedBugs || DisplayedBugs.length === 0) {
    return;
  }
  let bug = DisplayedBugs[Math.floor(Math.random() * DisplayedBugs.length)];
  let url = 'https://' + TriageConfig.jsonConfig.bugzilla_domain + '/show_bug.cgi?id=' + bug.id;
  window.open(url, '_buglist');
}

function loadBugListDetail(onComplete) {
  if (!BugQueries) {
    return;
  }

  $("#errors").empty();

  let pending = 2;
  function queryDone() {
    if (--pending === 0 && typeof onComplete === 'function') {
      onComplete();
    }
  }

  // Fire off a single bugzilla request per report
  let url = TriageConfig.jsonConfig.BUGZILLA_REST_URL + TriageData['url'];
  let key = getAPIKeyFromStorage();
  let headers = {};
  if (key != null && key.length) {
    headers['X-Bugzilla-api-key'] = key;
  }

  // Limit what data we retreive for better performance.
  url += "&include_fields=" + TriageConfig.jsonConfig.include_fields;

  $.ajax({
    url: url,
    crossDomain:true,
    dataType: 'json',
    ifModified: true,
    headers: headers,
    success: function(data, status) {
      if (status === 'success') {
        // Global
        BugData = data;
        displayBugLists(updateBugList, 'data', BugData);
        updateStats();
      }
      queryDone();
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
      } catch(e) {
      }
      queryDone();
    }
  });

  // Fire off a bugzilla request
  url = TriageConfig.jsonConfig.BUGZILLA_REST_URL + TriageData['uburl'];

  // Limit what data we retreive for better bugzilla query performance.
  url += "&" + TriageConfig.jsonConfig.include_fields;

  console.log(TriageConfig.jsonConfig.BUGZILLA_URL + TriageData['uburl']);

  $.ajax({
    url: url,
    crossDomain:true,
    dataType: 'json',
    ifModified: true,
    headers: headers,
    success: function(data, status) {
      if (status === 'success') {
        UBData = data;
        displayBugLists(updateBotList, 'ubdata', UBData);
        updateStats();
      }
      queryDone();
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
      } catch(e) {
      }
      queryDone();
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
  if (div === 'data') {
    DisplayedBugs = [];
  }

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
    let seccount = 0;

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
        if (div === 'data') {
          let isSecurity = bug.groups && bug.groups.some(g => (typeof g === 'string' ? g : (g.name || '')).includes('core-security'));
          if (isSecurity) {
            seccount++;
          } else {
            count++;
            DisplayedBugs.push(bug);
          }
        } else {
          count++;
        }
      } else {
        //console.log('no fit:', bug.id, bug.summary);
        //console.log(creationTime.valueOf(), from.valueOf(), to.valueOf())
      }
    }
    if (div === 'data') {
      query.bugcount = count;
      query.seccount = seccount;
    } else {
      query.ubcount = count;
    }

    let now = new Date();
    let year = getYear(now);
    let id = year + "-" + idx;

    // This id was generated in insertEmptyBugLists
    let bugUrl = TriageConfig.jsonConfig.BUGZILLA_URL + qurl;
    if (div === 'data') {
      bugUrl += '&f9=bug_group&o9=notsubstring&v9=core-security';
    }
    displayCallback(div, idx, count, bugUrl);

    if (div === 'data') {
      let secUrl = TriageConfig.jsonConfig.BUGZILLA_URL + qurl + '&f9=bug_group&o9=substring&v9=core-security';
      updateSecurityList(idx, seccount, secUrl);
    }

  }

  if (div === 'data') {
    $('.lucky-button').prop('disabled', DisplayedBugs.length === 0);
  }
}

// Add engineer names, bucket dates, and grayed out '?' buckets.
function populateBuckets(year, count) {
  if (!BugQueries) {
    return;
  }

  insertEmptyBugLists(year, count);

  for (let i = 0; i < BugQueries.length; i++) {
    let query = BugQueries[i];

    if (!("url" in query)) {
      continue;
    }

    let dfrom = query.from.split('-');
    let dto = query.to.split('-');

    let fromStr = MONTHS[dfrom[1]-1] + " " + dfrom[2];
    let toStr = MONTHS[dto[1]-1] + " " + dto[2];

    // Gray future buckets
    let now = new Date();
    let startDate = new Date(dfrom[0], parseInt(dfrom[1])-1, dfrom[2], 0, 0, 0, 0);
    let isFuture = !(now > startDate);

    let $bucket = $('.dev-bug-list').eq(i);
    $bucket.find('.who').text(query.who).toggleClass('gray-text', isFuture);
    $bucket.find('.date').text('(' + fromStr + ' - ' + toStr + ')').toggleClass('gray-text', isFuture);
  }
}

function insertEmptyBugLists(year, count) {
  if (!BugQueries) {
    return;
  }

  $("#content").remove();

  for (let i = 0; i < count; i++) {
    let $secdataLink = $('<a>').attr('target', '_buglist').attr('href', '');
    let $secdataSub = $('<div>').addClass('sub')
      .append($('<abbr>').attr('title', "Security bug(s) in this triage period (core-security group)").text('S'));
    let $secdata = $('<div>').addClass('secdata').attr('id', 'secdata' + i).hide()
      .append($secdataLink)
      .append($secdataSub);

    let $dataLink = $('<a>').attr('target', '_buglist').attr('href', '');
    let $dataSub = $('<div>').addClass('sub').hide()
      .append($('<abbr>').attr('title', "Bug(s) in Bugzilla with no `Severity` set").text('B'));
    let $data = $('<div>').addClass('data gray-text').attr('id', 'data' + i)
      .append($dataLink)
      .append($dataSub);

    let $ubdataLink = $('<a>').attr('target', '_buglist').attr('href', '');
    let $ubdataSub = $('<div>').addClass('sub')
      .append($('<abbr>').attr('title', "UpdateBot bug(s) in Bugzilla with no `Severity` set").text('UB'));
    let $ubdata = $('<div>').addClass('ubdata').attr('id', 'ubdata' + i).hide()
      .append($ubdataLink)
      .append($ubdataSub);

    let $div = $('<div>').addClass('dev-bug-list')
      .append($('<div>').addClass('who'))
      .append($('<div>').addClass('date'))
      .append($secdata)
      .append($data)
      .append($ubdata);

    $div.insertBefore('#errors');
  }
}

// bug list
function updateBugList(divId, divIndex, totalBugs, searchUrl) {
  let $data = $('#data' + divIndex);
  let $link = $data.find('a');
  let $sub = $data.find('.sub');

  if (totalBugs == 0) {
    $link.text('\u2022').addClass('grayed-dot').attr('href', searchUrl);
    // keep gray-text, leave .sub hidden
  } else {
    $link.text(totalBugs).attr('href', searchUrl);
    $data.removeClass('gray-text');
    $sub.show();
  }
}

// updatebot list
function updateBotList(divId, divIndex, totalBugs, searchUrl) {
  let $ubdata = $('#ubdata' + divIndex);
  if (totalBugs == 0) {
    $ubdata.find('a').text('\u2022').addClass('grayed-dot').attr('href', searchUrl);
    $ubdata.find('.sub').hide();
  } else {
    $ubdata.find('a').text(totalBugs).attr('href', searchUrl);
  }
  $ubdata.show();
}

// security bug list
function updateSecurityList(divIndex, totalBugs, searchUrl) {
  let $secdata = $('#secdata' + divIndex);
  if (totalBugs == 0) {
    $secdata.find('a').text('\u2022').addClass('grayed-dot').attr('href', searchUrl);
    $secdata.find('.sub').hide();
  } else {
    $secdata.find('a').text(totalBugs).attr('href', searchUrl);
  }
  $secdata.show();
}

function displayTitle(year, count) {
  let team = getTeam();

  $(".team-title").hide();
  let $el = $("#title-" + team);
  $el.find(".title-year").text(year);
  $el.show();
  document.title = $el.text();
}


function displayYearFooter(currentYear, selectedYear) {
  const team = getTeam();
  const $footer = $("#footer").empty();

  const makeLink = (year) => {
    const $a = $("<a>").attr("href", `?year=${year}&team=${team}`).text(year);
    if (year === selectedYear) {
      $a.addClass("current-year");
    }
    return $a;
  };

  [currentYear + 1, currentYear, currentYear - 1].forEach((year) => {
    $footer.append(makeLink(year));
  });
}

// Progress for queries
function cb_initProgress() {
  document.getElementById('progressmeter').max = TotalQueries;
  document.getElementById('progressmeter').value = 0;
  document.getElementById('progress').style.display = 'block';
  console.log('TotalQueries', TotalQueries);
}

function cb_stepdownProgress() {
  document.getElementById('progressmeter').value += 1;
  closeProgress();
}

function cb_closeProgress() {
  if (document.getElementById('progressmeter').value >= TotalQueries)
    document.getElementById('progress').style.display = 'none';
}

function onSettingsOpened() {
  $("#buglists").css('opacity', '0.5');
  $(".header").css('opacity', '0.5');
}

function onSettingsClosed() {
  $("#buglists").css('opacity', '1.0');
  $(".header").css('opacity', '1.0');
}
