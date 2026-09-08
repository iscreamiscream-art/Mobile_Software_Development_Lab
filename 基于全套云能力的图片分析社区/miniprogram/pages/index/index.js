// pages/index/index.js —— 社区(首页)
const db = wx.cloud.database()
const posts = db.collection('posts')
const util = require('../../utils.js')

const BTN_SIZE = 88 // 发帖按钮宽高 px
const MOVE_THRESHOLD = 8 // 判定为拖动的位移阈值(px)
const LONG_PRESS = 400 // 判定为误触的长按时长(ms)

Page({
  data: {
    posts: [],
    btnLeft: 0,
    btnTop: 0,
    loading: false,
    isLogin: false // 是否登录(游客仅能浏览+点赞)
  },

  onLoad() {
    this.initFloatBtn()
  },

  onShow() {
    this.setData({ isLogin: util.isLogin() })
    this.loadPosts()
  },

  // 读取帖子流，标记当前身份的点赞/收藏状态
  async loadPosts() {
    if (this._loading) return
    this._loading = true
    try {
      const key = await util.getLikeKey()
      const res = await posts.orderBy('addDate', 'desc').limit(20).get()
      const list = util.markMe(res.data, key)
      this.setData({ posts: list, isLogin: util.isLogin() })
    } catch (err) {
      console.error('读取帖子失败：', err)
      wx.showToast({ title: '请确认已创建 posts 集合', icon: 'none' })
    } finally {
      this._loading = false
    }
  },

  // 初始化发帖按钮默认位置(右下角)
  initFloatBtn() {
    const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this._winW = sys.windowWidth
    this._winH = sys.windowHeight
    this.setData({
      btnLeft: this._winW - BTN_SIZE - 16,
      btnTop: this._winH - BTN_SIZE - 24
    })
  },

  onBtnStart(e) {
    const t = e.touches[0]
    this._startX = t.clientX
    this._startY = t.clientY
    this._baseLeft = this.data.btnLeft
    this._baseTop = this.data.btnTop
    this._moved = false
    this._longPress = false

    if (this._pressTimer) clearTimeout(this._pressTimer)
    this._pressTimer = setTimeout(() => {
      if (!this._moved) this._longPress = true
    }, LONG_PRESS)
  },

  onBtnMove(e) {
    const t = e.touches[0]
    const dx = t.clientX - this._startX
    const dy = t.clientY - this._startY

    if (!this._moved && (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD)) {
      this._moved = true
      if (this._pressTimer) {
        clearTimeout(this._pressTimer)
        this._pressTimer = null
      }
    }
    if (!this._moved) return

    let left = this._baseLeft + dx
    let top = this._baseTop + dy
    left = Math.max(0, Math.min(this._winW - BTN_SIZE, left))
    top = Math.max(0, Math.min(this._winH - BTN_SIZE - 8, top))
    this.setData({ btnLeft: left, btnTop: top })
  },

  onBtnEnd() {
    if (this._pressTimer) {
      clearTimeout(this._pressTimer)
      this._pressTimer = null
    }
    if (this._moved || this._longPress) return
    this.goPublish()
  },

  // 发帖需要登录
  goPublish() {
    if (!util.isLogin()) {
      this.needLogin('发布帖子')
      return
    }
    wx.navigateTo({ url: '/pages/publish/publish' })
  },

  // 游客需要登录的引导
  needLogin(what) {
    wx.showModal({
      title: '需要登录',
      content: what + ' 需要登录。登录后头像昵称会显示在帖子里。',
      confirmText: '去登录',
      cancelText: '取消',
      success: (r) => {
        if (r.confirm) wx.switchTab({ url: '/pages/mine/mine' })
      }
    })
  },

  // 去某用户主页
  goHomepage(e) {
    const id = e.currentTarget.dataset.openid
    wx.navigateTo({ url: '/pages/homepage/homepage?id=' + id })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  },

  // 预览帖子图片
  preview(e) {
    const url = e.currentTarget.dataset.url
    const id = e.currentTarget.dataset.id
    const post = this.data.posts.find((p) => p._id === id) || {}
    wx.previewImage({
      current: url,
      urls: post.images || [url]
    })
  },

  // 点赞/取消点赞：游客也可(用游客 key)，总数全局共享
  async onLike(e) {
    const id = e.currentTarget.dataset.id
    const i = this.data.posts.findIndex((p) => p._id === id)
    if (i < 0) return
    const post = this.data.posts[i]
    const action = post.liked ? 'unlike' : 'like'
    try {
      const key = await util.getLikeKey()
      const updated = await util.interact(id, action, key)
      this.setData({ ['posts[' + i + ']']: this.decorate(updated) })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  // 收藏：需登录
  async onFav(e) {
    if (!util.isLogin()) {
      this.needLogin('收藏')
      return
    }
    const id = e.currentTarget.dataset.id
    const i = this.data.posts.findIndex((p) => p._id === id)
    if (i < 0) return
    const post = this.data.posts[i]
    const action = post.faved ? 'unfav' : 'fav'
    try {
      const key = await util.getLikeKey()
      const updated = await util.interact(id, action, key)
      this.setData({ ['posts[' + i + ']']: this.decorate(updated) })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  // 分享计数(仅登录)：点击即计一次转发
  async onShare(e) {
    if (!util.isLogin()) {
      this.needLogin('分享')
      return
    }
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

  // 将云函数返回帖子整理为视图对象
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

  // 分享到微信(卡片分享单帖；菜单分享则回首页)
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
      title: '图片分享社区，快来看看吧',
      path: '/pages/index/index'
    }
  }
})
