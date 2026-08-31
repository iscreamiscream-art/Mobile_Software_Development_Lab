// utils/store.js
// 纯本地存储数据层：点赞 / 评论全部存本地缓存，简单可靠。
// 未登录（anon）也能查看点赞数（只读）；微信登录后可点赞 / 评论。
// 接口保持 Promise 风格，页面调用无需改动。

const LOCAL_KEYS = {
  likes: 'newsLikes',
  comments: 'newsComments'
}

// 初始化：合并旧版按身份隔离的点赞缓存为统一缓存，并清理云模式遗留缓存
function initCloud() {
  try {
    let merged = wx.getStorageSync(LOCAL_KEYS.likes)
    if (!merged || typeof merged !== 'object') merged = {}
    // 旧版微信身份点赞数据并入统一缓存
    let oldWx = wx.getStorageSync('newsLikes_wx')
    if (oldWx && typeof oldWx === 'object') {
      for (let k in oldWx) {
        if (!merged[k]) merged[k] = oldWx[k]
      }
    }
    wx.setStorageSync(LOCAL_KEYS.likes, merged)
    wx.removeStorageSync('newsLikes_wx')
    wx.removeStorageSync('newsLikes_guest')
    wx.removeStorageSync('myOpenId')
  } catch (e) {}
}

// 当前身份对应的本地 ownerKey（评论归属判断）
function getOwnerKey() {
  let session = wx.getStorageSync('wxSession')
  return (session && session.code) ? session.code : ''
}

// 时间格式化 yyyy-MM-dd HH:mm
function formatTime(t) {
  let d = new Date(t)
  let pad = function (n) { return n < 10 ? '0' + n : '' + n }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

// ========== 评论 ==========

// 拉取评论列表
function getComments(articleId) {
  let comments = wx.getStorageSync(LOCAL_KEYS.comments)
  if (!comments || typeof comments !== 'object') comments = {}
  let list = comments[articleId] || []
  let ownerKey = getOwnerKey()
  return Promise.resolve(list.map(function (item) {
    return {
      id: item.id,
      content: item.content,
      nickName: item.nickName,
      src: item.src || '',
      time: item.time,
      timeText: formatTime(item.time),
      avatarText: (item.nickName || '匿').charAt(0),
      canDelete: item.ownerKey === ownerKey
    }
  }))
}

// 新增评论（新评论排最前）
function addComment(articleId, comment) {
  let comments = wx.getStorageSync(LOCAL_KEYS.comments)
  if (!comments || typeof comments !== 'object') comments = {}
  if (!comments[articleId]) comments[articleId] = []
  comments[articleId].unshift({
    id: 'c' + Date.now() + Math.floor(Math.random() * 1000),
    content: comment.content,
    nickName: comment.nickName,
    src: comment.src || '',
    time: Date.now(),
    ownerKey: getOwnerKey()
  })
  wx.setStorageSync(LOCAL_KEYS.comments, comments)
  return Promise.resolve(true)
}

// 删除评论
function deleteComment(commentId) {
  let comments = wx.getStorageSync(LOCAL_KEYS.comments)
  if (!comments || typeof comments !== 'object') return Promise.resolve(false)
  let found = false
  for (let key in comments) {
    let list = comments[key] || []
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === commentId) {
        list.splice(i, 1)
        found = true
        break
      }
    }
    if (found) break
  }
  if (found) wx.setStorageSync(LOCAL_KEYS.comments, comments)
  return Promise.resolve(found)
}

// ========== 点赞 ==========

// 读取统一点赞缓存：{ [articleId]: { count, liked } }
function loadLikes() {
  let likes = wx.getStorageSync(LOCAL_KEYS.likes)
  return (likes && typeof likes === 'object') ? likes : {}
}

// 拉取点赞状态：{ count, liked }；未登录只读，不显示已赞态
function fetchLikeState(articleId, type) {
  let data = loadLikes()[articleId] || { count: 0, liked: false }
  if (type === 'anon') {
    return Promise.resolve({ count: data.count, liked: false })
  }
  return Promise.resolve({ count: data.count, liked: !!data.liked })
}

// 点赞 / 取消点赞：{ ok, liked, count }；未登录不可点赞
function toggleLike(articleId, type) {
  if (type === 'anon') {
    return Promise.resolve({ ok: false })
  }
  let likes = loadLikes()
  let data = likes[articleId] || { count: 0, liked: false }
  data.liked = !data.liked
  data.count += data.liked ? 1 : -1
  if (data.count < 0) data.count = 0
  likes[articleId] = data
  wx.setStorageSync(LOCAL_KEYS.likes, likes)
  return Promise.resolve({ ok: true, liked: data.liked, count: data.count })
}

module.exports = {
  initCloud: initCloud,
  getComments: getComments,
  addComment: addComment,
  deleteComment: deleteComment,
  fetchLikeState: fetchLikeState,
  toggleLike: toggleLike
}
