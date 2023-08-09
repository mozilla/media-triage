/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var BIG_SCREEN = "bigscreen";
var SMALL_SCREEN = "smallscreen";

var BUGZILLA_URL;
var BUGZILLA_REST_URL;
var bugQueries;
var CALENDAR_URL;

// Not worth chasing toLocaleDateString etc. compatibility
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

$(document).ready(function () {
  $.getJSON('js/triage.json', function(data) {
    main(data);
  });
});

function main(json) {
  checkConfig();

  // Load ICS file

  var now = new Date();
  var currentYear = now.getFullYear();

  if (getTeam() == undefined) {
    window.location.href = window.location.href + "?year=2023&future=1&team=playback"
    return;
  }

  var triage = json.triage;
  BUGZILLA_URL = triage.BUGZILLA_URL;
  BUGZILLA_REST_URL = triage.BUGZILLA_REST_URL;

  $("#subtitle").replaceWith("<div id=\"subtitle\" class=\"subtitle\">Incoming Bug Triage</div>");
  switch (getTeam()) {
    case 'playback':
      document.getElementById('team-select').selectedIndex = 0;
      CALENDAR_URL = triage.playback_ics;
      break;
    case 'graphics':
      document.getElementById('team-select').selectedIndex = 2;
      CALENDAR_URL = triage.graphics_ics;
      break;
    case 'webrtc':
      document.getElementById('team-select').selectedIndex = 1;
      CALENDAR_URL = triage.webrtc_ics;
      break;
  }

  $.ajax({
    url: CALENDAR_URL,
    crossDomain:true,
    crossOrigin: true,
    error: function (a, b, c) {
      console.log("ics file load error: " + c);
    },
    success: function(data) {
      var icsBugQueries = parseICS(data);
      var display = getDisplay();
      var year = getYear(now);
    
      bugQueries = icsBugQueries[year];
      var future = $.url().param('future');

      console.log('Querying for team', getTeam());

      // Create bugzilla urls for specific users and dates
      var count = setupQueryURLs(triage, getTeam(), future);

      var displayType = (future ? "future" : (year == currentYear ? "current" : "past"));
    
      displayTitle(year, count, displayType);
      displaySchedule(year);
      displayYearFooter(currentYear, displayType, icsBugQueries);
    
      getBugCounts();
    }
  });
}

function parseICS(icsdata) {
  var icsBugQueries = {};

  // Download calendar and parse into bugqueries.
  var ics = ical.parseICS(icsdata);

  for (let k in ics) {
    if (!ics.hasOwnProperty(k)) {
      console.log('no Own Property', k)
    }

    if (ics[k].type != 'VEVENT') {
      console.log('Not a VEVENT', k)
      continue;
    }

    var ev = ics[k];

    // console.log(ev.summary, ev.location, ev.start.getDate(), MONTHS[ev.start.getMonth()], ev.start.getFullYear());

    // Filter entries based on team name:
    // teams - webrtc, playback, graphics
    let team = getTeam()
    let summary = ev.summary.toLowerCase()

    if (team == 'webrtc' && summary.indexOf('webrtc') == -1) {
        continue;
    }
    if (team == 'playback' &&
        (summary.indexOf('playback') == -1 && summary.indexOf('media') == -1)
       ) {
        continue;
    }

    function dateToBz(date) {
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }

    var who = ev.summary;
    var startDate = dateToBz(ev.start);
    var endDate = dateToBz(ev.end);
    var year = `${ev.start.getFullYear()}`;
    var endyear = `${ev.end.getFullYear()}`;
    // ICS dates are inclusive
    const notAfterDate = new Date(ev.end);
    notAfterDate.setDate(ev.end.getDate() + 1);
    const notAfterBz = dateToBz(notAfterDate);

    //console.log('parseICS event:', '"' + who + '"', startDate, endDate, notAfterBz, year, endyear);

    if (parseInt(year) < 2022) {
      continue;
    }

    // Cleanup summaries a bit
    who = who.replace('webrtc triage', '');
    who = who.replace('playback triage', '');
    who = who.replace('[Incoming Triage] ', '');
    who = who.replace('WebRTC Triage', '');
    who = who.replace('Media Triage', '');

    if (!icsBugQueries[year])
      icsBugQueries[year] = [];

    if (!icsBugQueries[endyear])
      icsBugQueries[endyear] = [];

    const query = {
      who: who,
      from: startDate,
      to: endDate,
      notAfter: notAfterBz
    };
    icsBugQueries[year].push(query);
    if (year != endyear) {
      icsBugQueries[endyear].push(query);
    }
  }

  // Sort
  for (yearKey in icsBugQueries) {
    icsBugQueries[yearKey].sort(
      function(a, b){
         return new Date(a.from) > new Date(b.from);
      });
  }

  return icsBugQueries;
}

var LastErrorText = "";
function errorMsg(text) {
  if (LastErrorText == text)
    return;
  $("#errors").append(text);
  LastErrorText = text;
}

function displayTitle(year, count, displayType) {
  $("#title").append(" " + year);
  $("#header-bg").attr("class", "header-bg header-bg-" + displayType);
  if (displayType != "current") {
    $("#title").attr("class", "title-light");
    $("#subtitle").attr("class", "subtitle title-light");
  }

  var content = "";
  if (bugQueries) {
    for (var i = 0; i < count; i++) {
      content += "<div class=\"bugcount\" id=\"reportDiv" + year + "-" + i + "\"></div>\n";
    }
    $("#content").replaceWith(content);
  }
}

function displaySchedule(year) {
  if (!bugQueries) {
    return;
  }

  for (var i = 0; i < bugQueries.length; i++) {
    var query = bugQueries[i];

    if (!("url" in query)) {
      console.log('no url in query!');
      continue;
    }
    var dfrom = query.from.split('-');
    var dto = query.to.split('-');
    var id = year + "-" + i;

    $("#reportDiv" + id).replaceWith("<div class=\"bugcount\"><h3>"
                                  + query.who
                                  + "</h3>"
                                  + "<h5>("
                                  + MONTHS[dfrom[1]-1] + " " + dfrom[2] + " - "
                                  + MONTHS[dto[1]-1] + " " + dto[2] + ")</h5>"
                                  + "<div id=\"data" + i + "\"" + " class=\"data greyedout\">?</div>"
                                  + "<div id=\"ubdata" + i + "\"" + " class=\"data greyedout\">?</div>"
                                  + "</div>");
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

function setupQueryURLs(triage, team, displayFuture) {
  if (!bugQueries) {
    console.log("no bug queries found.")
    return 0;
  }

  // Do not show results for dates that are too close to today.  Only once we
  // are five days after the end of the term...
  var cutoff = new Date();
  for (var i = 0; i < bugQueries.length; i++) {
    // If this is the schedule, display all queries for the year, otherwise filter
    // out future queries.
    if (!displayFuture) {
      var dto = new Date(bugQueries[i].from);
      if (cutoff < dto) {
        return i;
      }
    }

    let search_params = triage.generic_bugzilla_search_template;
    let ubsearch = triage.updatebot_bugzilla_search_template;
    let components;

    switch (team) {
      case 'graphics':
        components = triage.graphics_components;
        break;
      case 'playback':
        components = triage.playback_components;
        break;
      case 'webrtc':
        components = triage.webrtc_components;
        break;
    }

    // Bugzilla searches
    search_params = search_params.replace(/<COMPONENT>/g, components);
    search_params = search_params.replace(/<AFTER>/g, bugQueries[i].from).replace(/<NOT-AFTER>/g, bugQueries[i].notAfter);
    bugQueries[i]["url"] = search_params;

    // Bugzilla updatebot searches
    ubsearch = ubsearch.replace(/<COMPONENT>/g, components);
    ubsearch = ubsearch.replace(/<AFTER>/g, bugQueries[i].from).replace(/<NOT-AFTER>/g, bugQueries[i].notAfter);
    bugQueries[i]["uburl"] = ubsearch;
  }
  return bugQueries.length;
}

// callback from ics query load
function getBugCounts() {
  if (!bugQueries) {
    return;
  }

  $("#errors").empty();

  // Fire off bugzilla bug lists
  for (var i = bugQueries.length-1; i >= 0; i--) {
  let bugQuery = bugQueries[i];
    if (!("url" in bugQuery)) {
      console.log('no url in query!');
      continue;
    }

    let url = BUGZILLA_REST_URL + bugQuery.url + '&count_only=1';
    let key = getAPIKeyFromStorage(); 
    if (key != null && key.length) {
      url += "&api_key=" + key;
    }

    $.ajax({
      url: url,
      bugQuery: bugQuery,
      index: i,
      crossDomain:true,
      dataType: 'json',
      ifModified: true,
      success: function(data, status) {
        if (status === 'success') {
          this.bugQuery.count = data.bug_count;
          displayCount(bugQuery, this.index, this.bugQuery.count,
                       BUGZILLA_URL + this.bugQuery.url);
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

  // Fire off update bot queries
  for (var i = bugQueries.length-1; i >= 0; i--) {
    let bugQuery = bugQueries[i];

    if (!("uburl" in bugQuery)) {
      continue;
    }

    let url = BUGZILLA_REST_URL + bugQuery.uburl; // + '&count_only=1';
    let key = getAPIKeyFromStorage(); 
    if (key != null && key.length) {
      url += "&api_key=" + key;
    }

    //console.log(url);

    $.ajax({
      url: url,
      bugQuery: bugQuery,
      index: i,
      crossDomain:true,
      dataType: 'json',
      ifModified: true,
      success: function(data, status) {
        if (status === 'success') {
          this.bugQuery.count = data.bugs.length;
          // data population
          processListFor(url, data, this.index, this.bugQuery.count,
                         BUGZILLA_URL + this.bugQuery.uburl);
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.log("status:", textStatus);
        console.log("error thrown:", errorThrown);
        console.log("response text:", jqXHR.responseText);
        try {
          let info = JSON.parse(jqXHR.responseText);
          let text = info.message ? info.message : errorThrown;
          errorMsg(text);
          return;
        } catch(e) {
        }
        errorMsg(errorThrown);
      }
    });
  }

}

function displayCount(query, index, count, searchUrl) {
  if (count == 0) {
    $("#data" + index).replaceWith("<div class=\"data\"><a target='_buglist' href=\"" + searchUrl
                                     + "\"></a><div class='updata sub'></div></div>" );
    return;
  }

  $("#data" + index).replaceWith("<div class=\"data\"><a target='_buglist' href=\"" + searchUrl
                                   + "\">" + count + "</a><div class='updata sub'>B</div></div>" );
}

// updatebot
function processListFor(url, data, index, count, searchUrl) {
  
  if (count == 0) {
    $("#ubdata" + index).replaceWith("" );
    return;
  }

  $("#ubdata" + index).replaceWith("<div class='ubdata''><a target='_buglist' href=\"" + searchUrl
                                  + "\">" + count + "</a><div class='updata sub'>UB</div></div>" );
  /*
  data.bugs.forEach(function (bug) {
    // Returns a js object containing all the bug's info we display.
    let res = parseBugSummary(bug.id, bug.summary, bug.assigned_to, bug.creation_time, bug.resolution);
    if (res == null) {
      console.log('error parsing bug:', bug);
      return;
    }
  });
  */
}

