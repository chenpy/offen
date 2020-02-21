/** @jsx h */
const { h } = require('preact')
const { useState } = require('preact/hooks')
const classnames = require('classnames')

const Table = (props) => {
  const { rows, onEmptyMessage = __('No data available for this view.') } = props
  var tBody = Array.isArray(rows) && rows.length
    ? rows.map(function (row, index) {
      return (
        <tr key={index} class='striped--near-white'>
          <td class='truncate pv2 ph1'>
            {row.key}
          </td>
          <td class='pv2 ph1'>
            {row.count}
          </td>
        </tr>
      )
    })
    : (
      <tr>
        <td class='pl1 moon-gray' colspan='2'>
          {onEmptyMessage}
        </td>
      </tr>
    )

  return (
    <table class='collapse dt--fixed mb2'>
      <thead>
        <tr>
          <th class='w-70 normal tl pv2 ph1 moon-gray'>
            {props.columnNames[0]}
          </th>
          <th class='w-30 normal tl pv2 ph1 moon-gray'>
            {props.columnNames[1]}
          </th>
        </tr>
      </thead>
      <tbody>
        {tBody}
      </tbody>
    </table>
  )
}

exports.Table = Table

const Container = (props) => {
  const { removeBorder, children } = props
  const [selectedTab, setSelectedTab] = useState(0)
  const tableSets = Array.isArray(children)
    ? children
    : [children]

  const headlines = tableSets.map(function (set, index) {
    if (!set.props.headline) {
      return null
    }
    var css = []
    if (tableSets.length === 1) {
      css.push('f5', 'normal', 'dib', 'pv3')
    }
    if (tableSets.length > 1) {
      css.push('f5', 'normal', 'link', 'dim', 'dib', 'pt2', 'pb3', 'mr3', 'dark-green')
    }

    let handleClick = null
    if (tableSets.length > 1) {
      css.push('pointer')
      handleClick = () => setSelectedTab(index)
    }
    if (index === selectedTab && tableSets.length !== 1) {
      css.push('b', 'bt', 'bw2', 'b--dark-green')
    }
    return (
      <a key={index} role='button' class={classnames(css)} onclick={handleClick}>
        {set.props.headline}
      </a>
    )
  })
    .filter(Boolean)

  var wrapperClass = ['nowrap', 'overflow-x-auto', 'mb4']
  if (!removeBorder) {
    wrapperClass.push('bt', 'b--light-gray')
  }

  return (
    <div>
      <div class={classnames(wrapperClass)}>
        {headlines.length
          ? (<div>{headlines}</div>)
          : null}
        {tableSets[selectedTab]}
      </div>
    </div>
  )
}

exports.Container = Container