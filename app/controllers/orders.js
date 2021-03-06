'use strict'

const controller = require('lib/wiring/controller')
const models = require('app/models')
const Order = models.order

const authenticate = require('./concerns/authenticate')
const setUser = require('./concerns/set-current-user')
const setModel = require('./concerns/set-mongoose-model')

const index = (req, res, next) => {
  Order.find()
    .populate('items.itemId')
    .then(orders => res.json({
      orders: orders.map((e) =>
        e.toJSON({ virtuals: true, user: req.user }))
    }))
    .catch(next)
}

const show = (req, res) => {
  console.log(req.params.id)
  Order.findById(req.params.id)
    .populate('items.itemId')
    .then((order) => {
      res.json({
        order: order.toJSON({ virtuals: true, user: req.user })
      })
    })
}

const create = (req, res, next) => {
  console.log(req.body)
  const order = Object.assign(req.body.order, {
    _owner: req.user._id
  })
  let createdOrder
  Order.create(order)
    .then((order) => {
      createdOrder = order
      req.user.cart = []
      return req.user.save()
    })
    .then(() =>
      res.status(201)
        .json({
          order: createdOrder.toJSON({ virtuals: true, user: req.user })
        }))
    .catch(next)
}

const update = (req, res, next) => {
  delete req.body.order._owner  // disallow owner reassignment.

  req.order.update(req.body.order)
    .then(() => res.sendStatus(204))
    .catch(next)
}

const destroy = (req, res, next) => {
  req.order.remove()
    .then(() => res.sendStatus(204))
    .catch(next)
}

module.exports = controller({
  index,
  show,
  create,
  update,
  destroy
}, { before: [
  { method: setUser, only: ['index', 'show'] },
  { method: authenticate, except: ['index', 'show'] },
  // { method: setModel(Order), only: ['show'] },
  { method: setModel(Order, { forUser: true }), only: ['update', 'destroy'] }
] })
