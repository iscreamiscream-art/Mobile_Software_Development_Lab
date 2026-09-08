// pages/detail/detail.js —— 帖子详情
const db = wx.cloud.database()
const posts = db.collection('posts')
const util = require('../../utils.js')

Page({
  data: {
    id: '',
    post: null,
    loading: true,
    isLogin: false
  },

  onLoad(options) {
    this.setData({ id: options.id || '', isLogin: util.isLogin() })
    this.loadPost()
  },

  onShow() {
    this.setData({ isLogin: util.isLogin() })
  },

  async loadPost() {
    if (!this.data.id) {
      this.setData({ loading: false })
      return
    }
    try {
      const key = await util.getLikeKey()
      const res = await posts.doc(this.data.id).get()
      const arr = util.markMe([res.data], key)
      this.setData({ post: this.decorate(arr[0]), loading: false })
      this.addView()
    } catch (err) {
      console.error('读取帖子失败：', err)
      this.setData({ loading: false })
      wx.showToast({ title: '帖子不存在或已删除', icon: 'none' })
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

  // 增加一次浏览计数(失败静默忽略)
  addView() {
    if (!this._viewed && this.data.id) {
      this._viewed = true
      util.interact(this.data.id, 'view').catch(() => {})
    }
  },

  // 游客操作引导登录
  needLogin(what) {
    wx.showModal({
      title: '需要登录',
      content: what + ' 需要登录。登录后可点赞以外的更多操作。',
      confirmText: '去登录',
      cancelText: '取消',
      success: (r) => {
        if (r.confirm) wx.switchTab({ url: '/pages/mine/mine' })
      }
    })
  },

  goHomepage(e) {
    const id = e.currentTarget.dataset.openid
    wx.navigateTo({ url: '/pages/homepage/homepage?id=' + id })
  },

  preview(e) {
    const post = this.data.post
    wx.previewImage({
      current: e.currentTarget.dataset.url,
      urls: (post.images || []).length ? post.images : [e.currentTarget.dataset.url]
    })
  },

  // 点赞：游客也可
  async onLike() {
    const p = this.data.post
    if (!p) return
    try {
      const key = await util.getLikeKey()
      const updated = await util.interact(p._id, p.liked ? 'unlike' : 'like', key)
      this.setData({ post: this.decorate(updated) })
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  // 收藏：需登录
  async onFav() {
    if (!util.isLogin()) return this.needLogin('收藏')
    const p = this.data.post
    if (!p) return
    try {
      const key = await util.getLikeKey()
      const updated = await util.interact(p._id, p.faved ? 'unfav' : 'fav', key)
      this.setData({ post: this.decorate(updated) })
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  // 分享计数：仅登录
  async onShare() {
    if (!util.isLogin()) return this.needLogin('分享')
    const p = this.data.post
    if (!p) return
    try {
      const updated = await util.interact(p._id, 'share', await util.getLikeKey())
      this.setData({ post: this.decorate(updated) })
    } catch (err) {
      console.error(err)
    }
  },

  // 下载首图到本地相册(游客也可)
  onDownload() {
    const p = this.data.post
    const file = (p.images || [])[0]
    if (!file) return
    wx.showLoading({ title: '下载中...', mask: true })
    wx.cloud
      .downloadFile({ fileID: file })
      .then((res) => wx.saveImageToPhotosAlbum({ filePath: res.tempFilePath }))
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '已保存到相册', icon: 'success' })
      })
      .catch((err) => {
        wx.hideLoading()
        const msg = (err && err.errMsg) || ''
        if (msg.indexOf('auth') > -1 || msg.indexOf('deny') > -1) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许保存图片到相册',
            confirmText: '去设置',
            success(r) {
              if (r.confirm) wx.openSetting()
            }
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      })
  },

  onShareAppMessage() {
    const p = this.data.post
    if (!p) {
      return { title: '图片分享社区', path: '/pages/index/index' }
    }
    return {
      title: (p.nickName || '微信用户') + ' 分享了一条动态，快来看看',
      path: '/pages/detail/detail?id=' + p._id
    }
  }
})
