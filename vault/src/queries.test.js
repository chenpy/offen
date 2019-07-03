var assert = require('assert')
var uuid = require('uuid/v4')
var subDays = require('date-fns/sub_days')

var queries = require('./queries')
var getDatabase = require('./database')

describe('src/queries.js', function () {
  describe('getDefaultStats(db, query)', function () {
    context('with no data present', function () {
      var db
      var getDefaultStats

      beforeEach(function () {
        db = getDatabase('test-' + uuid())
        getDefaultStats = queries.getDefaultStatsWith(function () {
          return db
        })
      })

      it('returns an object of the correct shape without failing', function () {
        return getDefaultStats('test-account')
          .then(function (data) {
            assert.deepStrictEqual(
              Object.keys(data),
              [
                'uniqueUsers', 'uniqueAccounts', 'uniqueSessions',
                'referrers', 'pages', 'pageviews', 'bounceRate'
              ]
            )
            assert.strictEqual(data.uniqueUsers, 0)
            assert.strictEqual(data.uniqueAccounts, 0)
            assert.strictEqual(data.uniqueSessions, 0)
            assert.deepStrictEqual(data.referrers, [])

            assert.strictEqual(data.pageviews.length, 7)
            assert(data.pageviews.every(function (day) {
              return day.accounts === 0 &&
                day.pageviews === 0 &&
                day.visitors === 0
            }))
            assert(data.pageviews[0].jsonDate < data.pageviews[1].jsonDate)

            assert.strictEqual(data.bounceRate, 0)
          })
      })

      it('handles queries correctly', function () {
        return getDefaultStats('test-account', { numDays: 12 })
          .then(function (data) {
            assert.strictEqual(data.pageviews.length, 12)
          })
      })

      afterEach(function () {
        return db.delete()
      })
    })

    context('populated with data', function () {
      var db
      var getDefaultStats

      beforeEach(function () {
        db = getDatabase('test-' + uuid())
        getDefaultStats = queries.getDefaultStatsWith(function () {
          return db
        })

        var now = new Date()
        return db.events.bulkAdd([
          {
            accountId: 'test-account-1',
            userId: 'test-user-1',
            eventId: 'test-event-1',
            payload: {
              type: 'PAGEVIEW',
              href: 'https://www.offen.dev',
              title: 'Transparent web analytics',
              sessionId: 'session-id-1',
              referrer: '',
              timestamp: now.toJSON()
            }
          },
          {
            accountId: 'test-account-1',
            userId: 'test-user-1',
            eventId: 'test-event-2',
            payload: {
              type: 'PAGEVIEW',
              href: 'https://www.offen.dev/contact',
              title: 'Contact',
              sessionId: 'session-id-1',
              referrer: '',
              timestamp: now.toJSON()
            }
          },
          {
            accountId: 'test-account-1',
            userId: 'test-user-1',
            eventId: 'test-event-3',
            payload: {
              type: 'PAGEVIEW',
              href: 'https://www.offen.dev/deep-dive',
              title: 'Deep dive',
              sessionId: 'session-id-2',
              referrer: 'https://www.offen.dev',
              timestamp: subDays(now, 1).toJSON()
            }
          },
          {
            accountId: 'test-account-1',
            userId: 'test-user-2',
            eventId: 'test-event-4',
            payload: {
              type: 'PAGEVIEW',
              href: 'https://www.offen.dev/deep-dive',
              title: 'Deep dive',
              sessionId: 'session-id-3',
              referrer: '',
              timestamp: subDays(now, 1).toJSON()
            }
          },
          {
            accountId: 'test-account-2',
            userId: 'test-user-1',
            eventId: 'test-event-5',
            payload: {
              type: 'PAGEVIEW',
              href: 'https://www.puppies.com',
              title: 'Very cute',
              sessionId: 'session-id-4',
              referrer: 'https://www.cute.com',
              timestamp: subDays(now, 2).toJSON()
            }
          },
          {
            accountId: 'test-account-2',
            userId: 'test-user-1',
            eventId: 'test-event-6',
            payload: {
              type: 'PAGEVIEW',
              href: 'https://www.puppies.com',
              title: 'Very cute',
              sessionId: 'session-id-5',
              referrer: '',
              timestamp: subDays(now, 12).toJSON()
            }
          }
        ])
      })

      it('calculates stats correctly', function () {
        return getDefaultStats('test-account')
          .then(function (data) {
            assert.deepStrictEqual(
              Object.keys(data),
              [
                'uniqueUsers', 'uniqueAccounts', 'uniqueSessions',
                'referrers', 'pages', 'pageviews', 'bounceRate'
              ]
            )

            assert.strictEqual(data.uniqueUsers, 2)
            assert.strictEqual(data.uniqueAccounts, 2)
            assert.strictEqual(data.uniqueSessions, 4)
            assert.strictEqual(data.pages.length, 4)
            assert.strictEqual(data.referrers.length, 1)

            assert.strictEqual(data.pageviews[6].accounts, 1)
            assert.strictEqual(data.pageviews[6].pageviews, 2)
            assert.strictEqual(data.pageviews[6].visitors, 1)

            assert.strictEqual(data.pageviews[5].accounts, 1)
            assert.strictEqual(data.pageviews[5].pageviews, 2)
            assert.strictEqual(data.pageviews[5].visitors, 2)

            assert.strictEqual(data.pageviews[4].accounts, 1)
            assert.strictEqual(data.pageviews[4].pageviews, 1)
            assert.strictEqual(data.pageviews[4].visitors, 1)

            assert.strictEqual(data.pageviews[3].accounts, 0)
            assert.strictEqual(data.pageviews[3].pageviews, 0)
            assert.strictEqual(data.pageviews[3].visitors, 0)

            assert.strictEqual(data.bounceRate, 0.75)
          })
      })

      afterEach(function () {
        return db.delete()
      })
    })
  })
})
