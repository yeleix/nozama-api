'use strict'

const debug = require('debug')('express-api-template:users')

const controller = require('lib/wiring/controller')
const models = require('app/models')
const User = models.user

const crypto = require('crypto')

const authenticate = require('./concerns/authenticate')

const HttpError = require('lib/wiring/errors/http-error')

const MessageVerifier = require('lib/wiring/message-verifier')

const encodeToken = (token) => {
  const mv = new MessageVerifier('secure-token', process.env.SECRET_KEY)
  return mv.generate(token)
}

const getToken = () =>
  new Promise((resolve, reject) =>
    crypto.randomBytes(16, (err, data) =>
      err ? reject(err) : resolve(data.toString('base64'))
    )
  )

const index = (req, res, next) => {
  User.find({})
    .populate('cart.itemId') // Not working but i dont think needed?
    .then(users => res.json({ users }))
    .catch(next)
}

const show = (req, res, next) => {
  User.findById(req.params.id)
  .populate('cart.itemId') // Not working but i dont think needed?
    .then(user => user ? res.json({ user }) : next())
    .catch(next)
}

// How to use:: Send token and id of item to remove from cart. This will remove
// that item from the cart
// const removeItemFromCart = (req, res, next) => {
//   console.log(req.body.user.cart[0].itemId)
//   delete req.body.user._owner
//   req.user.update(
//     {$pull: { cart: { itemId: req.body.user.cart[0].itemId } }}
//   )
//   .then(() => res.sendStatus(204))
//   .catch(next)
// }

const update = (req, res, next) => {
  console.log('you should see this')
  console.log('req.user log test', req.user)
  console.log('req.user.cart = ', req.user.cart)
  console.log('req.params', req.params)
  console.log('req.body.user', req.body.user)
  // console.log(req.body.user)
  // console.log(req.body.user.cart)
  delete req.body.user._owner  // disallow owner reassignment.

  if (req.body.user.cart === 'empty string') {
    console.log('empty')
    req.user.cart = []
    req.user.save()
    res.sendStatus(204)
  } else {
    console.log('not empty')
    req.user.update(req.body.user)
      .then((d) => {
        console.log('data in update is', d)
        return d
      })
    .then(() => res.sendStatus(204))
    .catch(next)
  }
  // req.user.update(
  //   {$push: { cart: req.body.user.cart }})
  //   .then(() => res.sendStatus(204))
  //   .catch(next)
}

const makeErrorHandler = (res, next) =>
  error =>
    error && error.name && error.name === 'ValidationError'
      ? res.status(400).json({ error })
    : next(error)

const signup = (req, res, next) => {
  const credentials = req.body.credentials
  const user = { email: credentials.email, password: credentials.password }
  getToken()
    .then(token => {
      user.token = token
    })
    .then(() =>
      new User(user).save())
    .then(user =>
      res.status(201).json({ user }))
    .catch(makeErrorHandler(res, next))
}

const signin = (req, res, next) => {
  const credentials = req.body.credentials
  const search = { email: credentials.email }
  User.findOne(search)
    .populate('cart.itemId')
    .then(user =>
      user ? user.comparePassword(credentials.password)
            : Promise.reject(new HttpError(404)))
    .then(user =>
      getToken().then(token => {
        user.token = token
        return user.save()
      }))
    .then(user => {
      user = user.toObject()
      delete user.passwordDigest
      user.token = encodeToken(user.token)
      res.json({ user })
    })
    .catch(makeErrorHandler(res, next))
}

const signout = (req, res, next) => {
  getToken().then(token =>
    User.findOneAndUpdate({
      _id: req.params.id,
      token: req.user.token
    }, {
      token
    })
  ).then((user) =>
    user ? res.sendStatus(204) : next()
  ).catch(next)
}

const changepw = (req, res, next) => {
  debug('Changing password')
  User.findOne({
    _id: req.params.id,
    token: req.user.token
  }).then(user =>
    user ? user.comparePassword(req.body.passwords.old)
      : Promise.reject(new HttpError(404))
  ).then(user => {
    user.password = req.body.passwords.new
    return user.save()
  }).then((/* user */) =>
    res.sendStatus(204)
  ).catch(makeErrorHandler(res, next))
}

module.exports = controller({
  index,
  show,
  signup,
  signin,
  signout,
  changepw,
  update
  // removeItemFromCart
}, { before: [
  { method: authenticate, except: ['signup', 'signin'] } // TODO uncomment this before commit
] })
