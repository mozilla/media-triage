#!/usr/bin/env python3

import json
import os
import pprint
import getopt
import sys
import re
import html
import pprint
import datetime
import uuid

pp = pprint.PrettyPrinter(indent=2)

basicTemplate ="""
BEGIN:VEVENT
DTSTART;VALUE=DATE:%start%
DTEND;VALUE=DATE:%end%
RRULE:FREQ=WEEKLY;WKST=SU;INTERVAL=7;BYDAY=SA
DTSTAMP:20221227T134727Z
CREATED:20201210T121142Z
LAST-MODIFIED:20221227T134435Z
ORGANIZER;CN=Media Triage:mailto:mozilla.com_ovr8sdlln71kenc5nb43mo514o@gro
 up.calendar.google.com
DESCRIPTION:https://mozilla.github.io/media-triage/?team=webrtc
STATUS:CONFIRMED
TRANSP:TRANSPARENT
UID:%uid%
ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;
 CN=%email%;X-NUM-GUESTS=0:mailto:%email%
SUMMARY:%summary%
END:VEVENT"""

# print(basicTemplate)

initDate = datetime.date.fromisoformat('2022-12-31')
endDate = datetime.date.fromisoformat('2024-01-01')
delta = datetime.timedelta(days=7)

webrtc = [{
  'summary': 'Jan-Ivar WebRTC Triage',
  'email': 'jib@mozilla.com'
},
{
  'summary': 'Michael WebRTC Triage',
  'email': 'mfroman@mozilla.com'
},
{
  'summary': 'Jim WebRTC Triage',
  'email': 'jmathies@mozilla.com'
},
{
  'summary': 'Nico WebRTC Triage',
  'email': 'ngrunbaum@mozilla.com'
},
{
  'summary': 'Andreas WebRTC Triage',
  'email': 'apehrson@mozilla.com'
},
{
  'summary': 'Daniel WebRTC Triage',
  'email': 'dbaker@mozilla.com'
},
{
  'summary': 'Byron WebRTC Triage',
  'email': 'bwc@mozilla.com'
}]

media = [{
  'summary': 'Alastor Media Triage',
  'email': 'alwu@mozilla.com'
},
{
  'summary': 'Jim Media Triage',
  'email': 'jmathies@mozilla.com'
},
{
  'summary': 'Mathew Media Triage',
  'email': 'mgregan@mozilla.com'
},
{
  'summary': 'Karl Media Triage',
  'email': 'ktomlinson@mozilla.com'
},
{
  'summary': 'Ashley Media Triage',
  'email': 'azebrowski@mozilla.com'
},
{
  'summary': 'Paul Media Triage',
  'email': 'padenot@mozilla.com'
},
{
  'summary': 'Chun-Min Media Triage',
  'email': 'cchang@mozilla.com'
},
{
  'summary': 'John Media Triage',
  'email': 'jolin@mozilla.com'
},
{
  'summary': 'Andrew Media Triage',
  'email': 'aosmond@mozilla.com'
}
]

#teamLength = len(webrtc)
#teamData = webrtc
teamLength = len(media)
teamData = media

# print('team length=', teamLength)

entryIdx = 0
start = initDate
while start < endDate:
  end = start + (delta - datetime.timedelta(days=1))
  uuidStr = str(uuid.uuid4())
  
  # print("start date:", str(start), " end date:", str(end))

  entry = basicTemplate.replace("%summary%", teamData[entryIdx]['summary'])
  entry = entry.replace("%email%", teamData[entryIdx]['email'])
  entry = entry.replace("%start%", start.strftime("%Y%m%d"))
  entry = entry.replace("%end%", end.strftime("%Y%m%d"))
  entry = entry.replace("%uid%", uuidStr)

  print(entry)

  start += delta

  entryIdx += 1
  if entryIdx == teamLength:
    entryIdx = 0



