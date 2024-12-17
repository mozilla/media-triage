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
ORGANIZER;CN=Media Triage:%owneremail%
DESCRIPTION:%description%
SUMMARY:%summary%
STATUS:CONFIRMED
TRANSP:TRANSPARENT
UID:%uid%
ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;
 CN=%email%;X-NUM-GUESTS=0:mailto:%email%
END:VEVENT"""

# Note, spread in the ics is 8 days due to bugzilla query funniness.
# DTSTART;VALUE=DATE:20241209
# DTEND;VALUE=DATE:20241216
#  Opened: (changed after) 2024-12-9 Opened: (not changed after) 2024-12-16 
# so non-inclusive of the 9th, including the 16th
# todo:
#  - cal bug - displays both dates accurately

teamName = 'webrtc'

ownerEmailStr = 'mailto:jmathies@mozilla.com' # owneremail

# Note this date must start on a Sunday or the cal will be off by the week
# Alastor and Jim dec 30th, 2024
initDate = datetime.date.fromisoformat('2023-12-30') 
# This can land anywhere in the last week
finalDate = datetime.date.fromisoformat('2026-01-05')
delta = datetime.timedelta(days=7)

dataset = {
  'webrtcdesc': 'https://mozilla.github.io/media-triage/?team=webrtc',
  'mediadesc': 'https://mozilla.github.io/media-triage/?team=media',
  'webrtc': [{
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
    }],
  'media': [{
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
    }]
}

teamData = dataset[teamName]
teamLength = len(teamData)
entryIdx = 0

weekDate = initDate
endDate = initDate

while endDate < finalDate:
  # start date is Sunday (inclusive)
  startDate = weekDate
  # end date is the next Saturday (inclusive)
  endDate = startDate + datetime.timedelta(days=6)
  # In the bugzilla query processing in triage.js, the start date will start
  # at midnight of startDate, and end at midnight on endDate.

  uuidStr = str(uuid.uuid4())
  
  # print("start date:", str(startDate), " end date:", str(endDate), ' ', teamData[entryIdx]['summary'])

  entry = basicTemplate.replace("%summary%", teamData[entryIdx]['summary'])
  entry = entry.replace("%email%", teamData[entryIdx]['email'])
  entry = entry.replace("%start%", startDate.strftime("%Y%m%d"))
  entry = entry.replace("%end%", endDate.strftime("%Y%m%d"))
  entry = entry.replace("%uid%", uuidStr)
  entry = entry.replace("%owneremail%", ownerEmailStr)
  entry = entry.replace("%description%", dataset[teamName + 'desc'])

  print(entry)

  weekDate += delta

  entryIdx += 1
  if entryIdx == teamLength:
    entryIdx = 0



