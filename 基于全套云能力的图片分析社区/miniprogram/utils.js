// 通用工具函数

const GUEST_KEY = 'wx_guest_id'

// 获取当前 openid（缓存于全局）
function ensureOpenid() {
  const app = getApp()
  if (app.globalData.openid) return Promise.resolve(app.globalData.openid)
  return app.fetchOpenid()
}

// 当前登录资料（可能为空 = 游客）
function getProfile() {
  const app = getApp()
  return app.globalData.profile || null
}

// 是否已登录
function isLogin() {
  return !!getProfile()
}

// 游客本地会话 id(首次生成后固定，保证游客点赞状态稳定)
function getGuestId() {
  let id = wx.getStorageSync(GUEST_KEY)
  if (!id) {
    id = 'guest_' + Date.now() + '_' + Math.floor(Math.random() * 1e6)
    wx.setStorageSync(GUEST_KEY, id)
  }
  return id
}

// 获取“点赞身份 key”：
//  - 已登录: u_<openid>   (登录态)
//  - 游客:   g_<guestId>  (游客态，与登录态数据不互通)
async function getLikeKey() {
  if (getProfile()) {
    const openid = await ensureOpenid()
    return 'u_' + openid
  }
  return 'g_' + getGuestId()
}

// 生成排序时间：YYYY-MM-DD HH:mm:ss
function formatTime(date) {
  const d = date || new Date()
  const p = (n) => (n < 10 ? '0' + n : '' + n)
  return (
    d.getFullYear() +
    '-' +
    p(d.getMonth() + 1) +
    '-' +
    p(d.getDate()) +
    ' ' +
    p(d.getHours()) +
    ':' +
    p(d.getMinutes()) +
    ':' +
    p(d.getSeconds())
  )
}

// 为帖子列表标记当前身份的点赞/收藏状态(key: u_xxx / g_xxx)
// 点赞总数 = likedBy.length 仍全局共享
function markMe(posts, key) {
  if (!Array.isArray(posts)) return []
  return posts.map((p) => {
    const likedBy = p.likedBy || []
    const favedBy = p.favedBy || []
    return Object.assign({}, p, {
      liked: likedBy.indexOf(key) > -1,
      faved: favedBy.indexOf(key) > -1,
      likeCount: likedBy.length,
      favCount: favedBy.length,
      shareCount: p.shareCount || 0
    })
  })
}

// 触发点赞/取消/收藏/取消收藏/分享，userKey 为当前身份 key
function interact(postId, action, userKey) {
  return wx.cloud
    .callFunction({
      name: 'postOps',
      data: { postId, action, userKey }
    })
    .then((res) => res.result && res.result.post)
}

module.exports = {
  ensureOpenid,
  getProfile,
  isLogin,
  getLikeKey,
  formatTime,
  markMe,
  interact
}
