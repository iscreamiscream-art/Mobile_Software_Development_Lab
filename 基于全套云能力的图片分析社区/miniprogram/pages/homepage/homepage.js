// pages/homepage/homepage.js —— 他人主页
const db = wx.cloud.database()
const posts = db.collection('posts')
const util = require('../../utils.js')

Page({
  data: {
    openid: '',
    posts: [],
    user: null,
    loaded: false,
    isLogin: false
  },

  onLoad(options) {
    this.setData({ openid: options.id || '', isLogin: util.isLogin() })
  },

  async onShow() {
    this.setData({ isLogin: util.isLogin() })
    if (!this.data.openid) {
      wx.showToast({ title: '缺少用户标识', icon: 'none' })
      return
    }
    await this.reload()
  },

  async reload() {
    try {
      const key = await util.getLikeKey()
      const where = { _openid: this.data.openid }
      const res = await posts.where(where).orderBy('addDate', 'desc').get()
      const list = util.markMe(res.data, key)
      const first = res.data[0]
      const user = first
        ? {
            nickName: first.nickName || '微信用户',
            avatarUrl: first.avatarUrl || '',
            region: first.region || ''
          }
        : null
      this.setData({ posts: list, user, loaded: true })
    } catch (err) {
      console.error('读取用户主页失败：', err)
      this.setData({ loaded: true })
      wx.showToast({ title: '请确认已创建 posts 集合', icon: 'none' })
    }
  },

  // 游客引导登录
  needLogin(what) {
    wx.showModal({
      title: '需要登录',
      content: what + ' 需要登录。',
      confirmText: '去登录',
      cancelText: '取消',
      success: (r) => {
        if (r.confirm) wx.switchTab({ url: '/pages/mine/mine' })
      }
    })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  },

  preview(e) {
    const url = e.currentTarget.dataset.url
    const id = e.currentTarget.dataset.id
    const post = this.data.posts.find((p) => p._id === id) || {}
    wx.previewImage({ current: url, urls: post.images || [url] })
  },

  // 点赞：游客也可
  async onLike(e) {
    const id = e.currentTarget.dataset.id
    const i = this.data.posts.findIndex((p) => p._id === id)
    if (i < 0) return
    const p = this.data.posts[i]
    try {
      const key = await util.getLikeKey()
      const updated = await util.interact(id, p.liked ? 'unlike' : 'like', key)
      this.setData({ ['posts[' + i + ']']: this.decorate(updated) })
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  // 收藏：需登录
  async onFav(e) {
    if (!util.isLogin()) return this.needLogin('收藏')
    const id = e.currentTarget.dataset.id
    const i = this.data.posts.findIndex((p) => p._id === id)
    if (i < 0) return
    const p = this.data.posts[i]
    try {
      const key = await util.getLikeKey()
      const updated = await util.interact(id, p.faved ? 'unfav' : 'fav', key)
      this.setData({ ['posts[' + i + ']']: this.decorate(updated) })
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  // 分享计数：仅登录
  async onShare(e) {
    if (!util.isLogin()) return this.needLogin('分享')
    const id = e.currentTarget.dataset.id
    const i = this.data.posts.findIndex((p) => p._id === id)
    if (i < 0) return
    try {
      const updated = await util.interact(id, 'share', await util.getLikeKey())
      this.setData({ ['posts[' + i + ']']: this.decorate(updated) })
    } catch (err) {
      console.error(err)
    }
  },

  decorate(p) {
    return Object.assign({}, p, {
      liked: !!p.liked,
      faved: !!p.faved,
      likeCount: p.likeCount || (p.likedBy || []).length,
      favCount: p.favCount || (p.favedBy || []).length,
      shareCount: p.shareCount || 0,
      single: (p.images || []).length === 1
    })
  },

  onShareAppMessage(options) {
    const id = options && options.target && options.target.dataset ? options.target.dataset.id : ''
    if (id) {
      const post = this.data.posts.find((p) => p._id === id)
      return {
        title: (post ? post.nickName || '' : '') + ' 分享了一条动态，快来看看',
        path: '/pages/detail/detail?id=' + id
      }
    }
    return {
      title: 'TA 的主页',
      path: '/pages/homepage/homepage?id=' + this.data.openid
    }
  }
})
