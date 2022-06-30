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

function main(json)
{
  var now = new Date();
  var currentYear = now.getFullYear();

  if (getTeam() == undefined) {
    window.location.href = window.location.href + "?year=2022&future=1&team=playback"
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

  console.log(CALENDAR_URL);

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

      var count = setupQueryURLs(triage, getTeam(), future);

      var displayType = (future ? "future" : (year == currentYear ? "current" : "past"));
    
      displayTitle(year, count, displayType);
      displaySchedule(year);
      displayYearFooter(currentYear, displayType, icsBugQueries);
    
      getBugCounts();
    }
  });
}

// graphics components -
// component=Canvas%3A%202D&component=GFX%3A%20Color%20Management&component=Graphics&component=Graphics%3A%20Layers&component=Graphics%3A%20Text&component=Graphics%3A%20WebRender&component=Image%20Blocking&component=ImageLib
// webrtc components - 
// component=WebRTC&component=WebRTC%3A%20Audio%2FVideo&component=WebRTC%3A%20Networking&component=WebRTC%3A%20Signaling
// media components - 
// component=Audio%2FVideo&component=Audio%2FVideo%3A%20cubeb&component=Audio%2FVideo%3A%20GMP&component=Audio%2FVideo%3A%20MediaStreamGraph&component=Audio%2FVideo%3A%20Playback&component=Audio%2FVideo%3A%20Recording&component=Web%20Audio

// New generic query -
// ?v2=<FROM>&v3=<TO>&component=WebRTC&<COMPONENT>&product=Core&bug_status=UNCONFIRMED&bug_status=NEW&bug_status=ASSIGNED&bug_status=REOPENED&list_id=16022721&keywords_type=nowords&o3=changedafter&f5=bug_severity&keywords=meta&o2=changedafter&emailassigned_to1=1&f6=bug_type&n3=1&email1=nobody%40mozilla.org&f3=creation_ts&o5=equals&query_format=advanced&v6=defect&f1=OP&f2=creation_ts&f4=CP&emailtype1=exact&o6=equals&v5=--

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

    // Filter based on team name.
    if (getTeam() != 'graphics' && ev.summary.indexOf(getTeam()) == -1) {
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

    console.log('parseICS event:', '"' + who + '"', startDate, endDate, notAfterBz, year, endyear);

    if (parseInt(year) < 2021) {
      continue;
    }

    who = who.replace('webrtc triage', '');
    who = who.replace('playback triage', '');
    who = who.replace('[Incoming Triage] ', '');

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

function getYear(now)
{
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

function getDisplay()
{
  var display = $.url().param('display');
  if (display && (display === BIG_SCREEN)) {
    return BIG_SCREEN;
  }
  return SMALL_SCREEN;
}

function displayTitle(year, count, displayType)
{
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

function displaySchedule(year)
{
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
                                  + "<div id=\"data" + i + "\""
                                  + " class=\"data greyedout\">?</div></div>");
  }
}

function displayYearFooter(currentYear, displayType, icsBugQueries)
{
  var footer = "<br><br><br><br><div id=\"footer\" class=\"footer-" + displayType + "\">Year &gt; ";
  var nextYear = currentYear + 1;

  // If the ics file has dates for future years. Generally shouldn't show up unless you're
  // near the end of the year and the generation script ran into the new year.
  if (("" + nextYear) in icsBugQueries) {
    footer += "<a href=\"?year=" + (nextYear) + "&future=1&team=" + getTeam() + "\">" + (nextYear) + "</a> | ";
  }

  // The future schedule
  footer += "<a href=\"?year=" + currentYear + "&future=1&team=" + getTeam() + "\">Schedule</a>";

  for (var year = currentYear; year >= 2020; year--) {
    footer += "<a href=\"?year=" + year + "&team=" + getTeam() + "\">" + year + "</a> | ";
  }
  footer += "</div>";
  $("#body").append(footer);
}

function setupQueryURLs(triage, team, displayFuture)
{
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

    var search_params = triage.generic_bugzilla_search_template;
    var components;

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

    search_params = search_params.replace(/<COMPONENT>/g, components);
    search_params = search_params.replace(/<AFTER>/g, bugQueries[i].from).replace(/<NOT-AFTER>/g, bugQueries[i].notAfter);
    bugQueries[i]["url"] = search_params;
  }
  return bugQueries.length;
}

function getBugCounts()
{
  if (!bugQueries) {
    return;
  }
  for (var i = bugQueries.length-1; i >= 0; i--) {
    var bugQuery = bugQueries[i];
    if (!("url" in bugQuery)) {
      console.log('no url in query!');
      continue;
    }
    $.ajax({
      url: BUGZILLA_REST_URL + bugQuery.url + '&count_only=1',
      bugQuery: bugQuery,
      index: i,
      crossDomain:true,
      dataType: 'json',
      ifModified: true,
      success: function(data, status) {
        if (status === 'success') {
          this.bugQuery.count = data.bug_count;
          displayCount(this.index, this.bugQuery.count,
                       BUGZILLA_URL + this.bugQuery.url);
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        console.log(textStatus);
      }
    });
  }
}

function displayCount(index, count, url)
{
  if (count == 0)
    count = '&nbsp;';
  $("#data" + index).replaceWith("<div class=\"data\"><a target='_buglist' href=\"" + url
                                 + "\">" + count + "</a></div>" );
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
