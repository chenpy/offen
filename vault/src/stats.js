/**
 * Copyright 2020 - Offen Authors <hioffen@posteo.de>
 * SPDX-License-Identifier: Apache-2.0
 */

var _ = require('underscore')

var placeInBucket = require('./buckets')

// `loss` is the percentage of anonymous events (i.e. events without a
// user identifier) in the given set of events.
exports.loss = consumeAsync(loss)

function loss (events) {
  var totalCount = events.length
  if (totalCount === 0) {
    return 0
  }
  var nonNullCount = countKeys('secretId', false)(events)
  return 1 - (nonNullCount / totalCount)
}

// The bounce rate is calculated as the percentage of session identifiers
// in the set of events that are associated with one event only, i.e. there
// has been no follow-up event.
exports.bounceRate = consumeAsync(bounceRate)

function bounceRate (aggregate) {
  var compacted = _.compact(aggregate.sessionIds)
  var countById = _.countBy(compacted, _.identity)
  var sessions = _.values(countById)
  var bounces = _.filter(sessions, function (length) {
    return length === 1
  })

  if (sessions.length === 0) {
    return 0
  }

  // The bounce rate is the percentage of sessions where there is only
  // one event with the respective identifier in the given se
  return bounces.length / sessions.length
}

// `referrers` is the list of referrer values, grouped by host name. Common
// referrers (i.e. search engines or apps) will replaced with a human-friendly
// name assigned to their bucket.
exports.referrers = consumeAsync(referrers)

function referrers (aggregate) {
  return _referrers(aggregate, function (ref) {
    return placeInBucket(ref.host || ref.href)
  })
}

// `campaigns` groups the referrer values by their `utm_campaign` if present
exports.campaigns = consumeAsync(campaigns)

function campaigns (aggregate) {
  return _referrers(aggregate, function (ref) {
    return ref.searchParams.get('utm_campaign')
  })
}

// `sources` groups the referrer values by their `utm_source` if present
exports.sources = consumeAsync(sources)

function sources (aggregate) {
  return _referrers(aggregate, function (ref) {
    return ref.searchParams.get('utm_source')
  })
}

function _referrers (aggregate, extractValueFn) {
  return _.chain(aggregate.sessionIds)
    .uniq()
    .map(function (sessionId) {
      var index = _.indexOf(aggregate.sessionIds, sessionId)
      return {
        href: aggregate.hrefs[index],
        referrer: aggregate.referrers[index],
        length: aggregate.sessionIds.filter(function (id) { return id === sessionId }).length
      }
    })
    .filter(function (sessionItem) {
      return sessionItem.referrer && sessionItem.href.host !== sessionItem.referrer.host
    })
    .map(function (sessionItem) {
      sessionItem.referrerVal = extractValueFn(sessionItem.referrer)
      return sessionItem
    })
    .filter(function (sessionItem) {
      return sessionItem.referrerVal
    })
    .groupBy('referrerVal')
    .map(function (sessionItems, key) {
      var sum = sessionItems.reduce(function (acc, next) {
        return acc + next.length
      }, 0)
      return {
        key: key,
        count: [
          sessionItems.length,
          sum / sessionItems.length
        ]
      }
    })
    .sortBy(function (row) { return row.count[0] })
    .reverse()
    .value()
}

// `pages` contains all pages visited sorted by the number of pageviews.
// URLs are stripped off potential query strings and hash parameters
// before grouping.
exports.pages = consumeAsync(pages)

function pages (aggregate) {
  return _pages(aggregate, false)
}

// `activePages` contains the pages last visited by each user in the given set
// of events and is sorted by the number of pageviews.
// URLs are stripped off potential query strings and hash parameters
// before grouping.
exports.activePages = consumeAsync(activePages)

function activePages (aggregate) {
  return _pages(aggregate, true)
}

function _pages (aggregate, perSession) {
  var hrefSelection = perSession
    ? _.chain(aggregate.sessionIds)
      .uniq()
      .map(function (sessionId) {
        return _.lastIndexOf(aggregate.sessionIds, sessionId)
      })
      .map(function (index) {
        return aggregate.hrefs[index]
      })
      .value()
    : aggregate.hrefs

  return _.chain(hrefSelection)
    .map(function (href, index) {
      if (!href) {
        return null
      }
      var strippedHref = href.origin + href.pathname
      return { accountId: aggregate.accountIds[index], href: strippedHref }
    })
    .compact()
    .groupBy('accountId')
    .values()
    .map(function (pageviewsPerAccount) {
      return _.chain(pageviewsPerAccount)
        .countBy('href')
        .pairs()
        .map(function (pair) {
          return { key: pair[0], count: pair[1] }
        })
        .value()
    })
    .flatten(true)
    .sortBy('count')
    .reverse()
    .value()
}

// `avgPageload` calculates the average pageload time of the given
// set of events
exports.avgPageload = consumeAsync(avgPageload)

function avgPageload (aggregate) {
  var applicable = aggregate.pageloads.filter(function (pageload) {
    return pageload && pageload > 0
  })
  var count = applicable.length
  if (count === 0) {
    return null
  }
  var sum = applicable.reduce(function (acc, next) {
    return acc + next
  }, 0)
  return sum / count
}

// `avgPageDepth` calculates the average session length in the given
// set of events
exports.avgPageDepth = consumeAsync(avgPageDepth)

function avgPageDepth (aggregate) {
  if (aggregate.sessionIds.length === 0) {
    return null
  }
  var compacted = _.compact(aggregate.sessionIds)
  var uniqueSessions = _.uniq(compacted).length
  return compacted.length / uniqueSessions
}

exports.exitPages = consumeAsync(exitPages)
// `exitPages` groups the given events by session identifier and then
// returns a sorted list of exit pages for these sessions. URLs will be
// stripped off query and hash parameters. Sessions that only contain
// a single page will be excluded.
function exitPages (aggregate) {
  return _.chain(aggregate.sessionIds)
    .countBy(_.identity)
    .pairs()
    .filter(function (pair) {
      return pair[1] !== 1
    })
    .map(function (pair) {
      var lastIndex = _.lastIndexOf(aggregate.sessionIds, pair[0])
      var match = aggregate.hrefs[lastIndex]
      return match && (match.origin + match.pathname)
    })
    .compact()
    .countBy(_.identity)
    .pairs()
    .map(function (pair) {
      return { key: pair[0], count: pair[1] }
    })
    .sortBy('count')
    .reverse()
    .value()
}

// `landingPages` groups the given events by session identifier and then
// returns a sorted list of landing pages for these sessions. URLs will be
// stripped off query and hash parameters.
exports.landingPages = consumeAsync(landingPages)

function landingPages (aggregate) {
  return _.chain(aggregate.sessionIds)
    .uniq()
    .map(function (sessionId) {
      var firstIndex = _.indexOf(aggregate.sessionIds, sessionId)
      var match = aggregate.hrefs[firstIndex]
      return match && (match.origin + match.pathname)
    })
    .compact()
    .countBy(_.identity)
    .pairs()
    .map(function (pair) {
      return { key: pair[0], count: pair[1] }
    })
    .value()
}

// `mobileShare` returns the percentage of events flagged as mobile
// in the given set of events.
exports.mobileShare = consumeAsync(mobileShare)

function mobileShare (aggregate) {
  if (!aggregate.isMobiles.length) {
    return null
  }
  var mobile = _.compact(aggregate.isMobiles)
  return mobile.length / aggregate.isMobiles.length
}

// `retention` calculates a retention matrix for the given slices of events.
// The function itself does not make any assumptions about how these chunks are
// distributed in time.
exports.retention = consumeAsync(retention)

function retention (/* ...events */) {
  var chunks = [].slice.call(arguments)
  var result = []
  while (chunks.length) {
    var head = chunks.shift()
    var referenceIds = _.chain(head).pluck('secretId').compact().uniq().value()
    var innerResult = chunks.reduce(function (acc, next) {
      var share
      if (referenceIds.length === 0) {
        share = 0
      } else {
        var matching = _.chain(next)
          .pluck('secretId').compact().uniq()
          .intersection(referenceIds).size().value()
        share = matching / referenceIds.length
      }
      acc.push(share)
      return acc
    }, [referenceIds.length ? 1 : 0])
    result.push(innerResult)
  }
  return result
}

// `returningUsers` calculates the percentage of returning visitors in the given range
// as compared to the list of all known events
exports.returningUsers = consumeAsync(returningUsers)

function returningUsers (events, allEvents) {
  var oldestEventIdInRange = _.chain(events)
    .pluck('eventId')
    .sortBy()
    .head()
    .value()

  var usersBeforeRange = _.chain(allEvents)
    .filter(function (event) {
      return event.eventId < oldestEventIdInRange
    })
    .pluck('secretId')
    .compact()
    .uniq()
    .value()

  var usersInRange = _.chain(events)
    .pluck('secretId')
    .compact()
    .uniq()
    .value()

  if (usersInRange.length === 0) {
    return 0
  }

  var newUsers = _.chain(usersInRange)
    .filter(function (secretId) {
      return !_.contains(usersBeforeRange, secretId)
    })
    .value()

  return 1 - (newUsers.length / usersInRange.length)
}

exports.pageviews = consumeAsync(countKeys('secretId', false))
// `visitors` is the number of unique users for the given
//  set of events.
exports.visitors = consumeAsync(countKeys('secretId', true))
// This is the number of unique accounts for the given timeframe
exports.accounts = consumeAsync(countKeys('accountId', true))
// This is the number of unique sessions for the given timeframe
exports.uniqueSessions = consumeAsync(uniqueSessions)
function uniqueSessions (aggregate) {
  return _.chain(aggregate.sessionIds)
    .compact()
    .uniq()
    .size()
    .value()
}

function countKeys (keys, unique) {
  return function (elements) {
    var list = _.map(elements, _.property(keys))
    list = _.compact(list)
    if (unique) {
      list = _.uniq(list)
    }
    return list.length
  }
}

// `consumeAsync` ensures the given function can be called with both
// synchronous and asynchronous values as arguments. The return value
// will be wrapped in a Promise.
function consumeAsync (fn, ctx) {
  ctx = ctx || null
  return function () {
    var args = [].slice.call(arguments)
    return Promise.all(args)
      .then(function (resolvedArgs) {
        return fn.apply(ctx, resolvedArgs)
      })
  }
}
