// pages/mine/mine.js —— 个人主页
const db = wx.cloud.database()
const posts = db.collection('posts') // 帖子
const photos = db.collection('photos') // 独立相册(仅图片)
const util = require('../../utils.js')

const app = getApp()

Page({
  data: {
    profile: null, // { nickName, avatarUrl(fileID) }
    openid: '',
    mine: false, // 是否为自己主页
    wall: [], // 九宫格照片墙
    myPosts: [],
    editNick: false,
    nickValue: '',
    isLogin: false,
    stat: { likeSum: 0, favSum: 0, viewSum: 0 } // 我的喜欢/收藏/浏览
  },

  async onShow() {
    const profile = util.getProfile()
    this.setData({ profile, isLogin: !!profile })
    // 仅登录后加载本人的相册与帖子；游客在此页仅展示登录入口
    if (profile) {
      try {
        await util.ensureOpenid()
        this.setData({ openid: app.globalData.openid })
        await Promise.all([this.loadMinePosts(), this.loadWall(), this.loadLikedCounts()])
      } catch (err) {
        console.error('个人主页初始化失败：', err)
      }
    } else {
      this.setData({ openid: '', myPosts: [], wall: [] })
    }
  },

  // 我的全部帖子
  async loadMinePosts() {
    const openid = app.globalData.openid
    if (!openid) return
    try {
      const key = await util.getLikeKey()
      const res = await posts.where({ _openid: openid }).orderBy('addDate', 'desc').get()
      const list = util.markMe(res.data, key)
      // 「浏览」= 我的内容被浏览总数(我的喜欢/收藏数量见 loadLikedCounts)
      const viewSum = (res.data || []).reduce((s, p) => s + (p.viewCount || 0), 0)
      this.setData({ myPosts: list, 'stat.viewSum': viewSum })
    } catch (err) {
      console.error(err)
    }
  },

  // 九宫格照片墙：从独立相册集合 photos 读取本人照片
  async loadWall() {
    const openid = app.globalData.openid
    if (!openid) return
    try {
      const res = await photos.where({ _openid: openid }).orderBy('addDate', 'desc').get()
      this.setData({ wall: res.data.map((p) => ({ _id: p._id, url: p.fileID })) })
    } catch (err) {
      console.error('读取相册失败：', err)
    }
  },

  // 选择并单独上传照片到相册(不上传到帖子)
  chooseUploadPhoto() {
    if (this._uploading) return
    wx.chooseImage({
      count: 9,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        if (res.tempFilePaths && res.tempFilePaths.length) this.uploadPhotos(res.tempFilePaths)
      }
    })
  },

  // 逐个上传到云存储并写入 photos 集合
  async uploadPhotos(paths) {
    if (this._uploading) return
    this._uploading = true
    wx.showLoading({ title: '上传中...', mask: true })
    try {
      for (let i = 0; i < paths.length; i++) {
        const ext = (paths[i].match(/\.(\w+)$/) || [, 'jpg'])[1]
        const cloudPath =
          'photos/' + Date.now() + '_' + Math.floor(Math.random() * 1e6) + '_' + i + '.' + ext
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: paths[i] })
        await photos.add({
          data: { fileID: up.fileID, addDate: util.formatTime(new Date()) }
        })
      }
      wx.hideLoading()
      wx.showToast({ title: '上传成功', icon: 'success' })
      this.loadWall()
    } catch (err) {
      console.error('照片上传失败：', err)
      wx.hideLoading()
      wx.showToast({ title: '上传失败，请重试', icon: 'none' })
    } finally {
      this._uploading = false
    }
  },

  // 相册图片预览
  previewWall(e) {
    const url = e.currentTarget.dataset.url
    const urls = this.data.wall.map((w) => w.url)
    wx.previewImage({ current: url, urls })
  },

  // ===== 登录：选择头像 =====
  onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl
    if (!tempPath) return
    wx.showLoading({ title: '上传头像...', mask: true })
    const cloudPath = 'avatars/' + Date.now() + '_' + Math.floor(Math.random() * 1e6) + '.png'
    wx.cloud
      .uploadFile({ cloudPath, filePath: tempPath })
      .then((res) => {
        wx.hideLoading()
        const cur = this.data.profile || { nickName: '' }
        const next = {
          nickName: cur.nickName || '微信用户',
          avatarUrl: res.fileID,
          bgUrl: cur.bgUrl || ''
        }
        app.setProfile(next)
        this.afterLogin(next)
        wx.showToast({ title: '头像已更新', icon: 'success' })
      })
      .catch((err) => {
        wx.hideLoading()
        console.error(err)
        wx.showToast({ title: '头像上传失败', icon: 'none' })
      })
  },

  // 登录成功后刷新页面并加载本人内容
  async afterLogin(profile) {
    this.setData({ profile, isLogin: true })
    try {
      await util.ensureOpenid()
      this.setData({ openid: app.globalData.openid })
      await Promise.all([this.loadMinePosts(), this.loadWall(), this.loadLikedCounts()])
    } catch (err) {
      console.error(err)
    }
  },

  // 更换个人主页背景图(需登录)
  changeBg() {
    if (!this.data.profile) {
      wx.showToast({ title: '请先登录再设置背景', icon: 'none' })
      return
    }
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        if (!res.tempFilePaths || !res.tempFilePaths[0]) return
        wx.showLoading({ title: '上传背景...', mask: true })
        const file = res.tempFilePaths[0]
        const ext = (file.match(/\.(\w+)$/) || [, 'jpg'])[1]
        const cloudPath = 'bg/' + Date.now() + '_' + Math.floor(Math.random() * 1e6) + '.' + ext
        wx.cloud
          .uploadFile({ cloudPath, filePath: file })
          .then((up) => {
            const cur = this.data.profile
            const next = {
              nickName: cur.nickName || '',
              avatarUrl: cur.avatarUrl || '',
              bgUrl: up.fileID
            }
            app.setProfile(next)
            this.setData({ profile: next, isLogin: true })
            wx.hideLoading()
            wx.showToast({ title: '背景已更新', icon: 'success' })
          })
          .catch((err) => {
            wx.hideLoading()
            console.error(err)
            wx.showToast({ title: '背景上传失败', icon: 'none' })
          })
      }
    })
  },

  // 开启昵称编辑
  startEditNick() {
    this.setData({
      editNick: true,
      nickValue: (this.data.profile && this.data.profile.nickName) || ''
    })
  },

  onNickInput(e) {
    this.setData({ nickValue: e.detail.value })
  },

  // 保存昵称
  saveNick() {
    const nick = (this.data.nickValue || '').trim() || '微信用户'
    const cur = this.data.profile || { avatarUrl: '' }
    const next = { nickName: nick, avatarUrl: cur.avatarUrl || '', bgUrl: cur.bgUrl || '' }
    app.setProfile(next)
    this.afterLogin(next)
    wx.showToast({ title: '昵称已更新', icon: 'success' })
  },

  // 去发布帖子
  goPublish() {
    wx.navigateTo({ url: '/pages/publish/publish' })
  },

  // 去详情
  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  },

  // 编辑个人简介(默认「说说什么吧」)
  editDesc() {
    const cur = this.data.profile
    if (!cur) return
    wx.showModal({
      title: '编辑个人简介',
      editable: true,
      placeholderText: '说说什么吧',
      content: cur.desc || '',
      success: (r) => {
        if (!r.confirm) return
        const v = (r.content || '').trim()
        const next = {
          nickName: cur.nickName || '微信用户',
          avatarUrl: cur.avatarUrl || '',
          bgUrl: cur.bgUrl || '',
          desc: v
        }
        app.setProfile(next)
        this.setData({ profile: next })
        wx.showToast({ title: '已保存', icon: 'success' })
      }
    })
  },

  // 进入 我的喜欢 / 我的收藏 列表
  goCollect(e) {
    const type = e.currentTarget.dataset.type
    wx.navigateTo({ url: '/pages/mycollect/mycollect?type=' + type })
  },

  // 删除我的帖子(含其图片)
  onDeletePost(e) {
    const id = e.currentTarget.dataset.id
    const post = this.data.myPosts.find((p) => p._id === id)
    if (!post) return
    wx.showModal({
      title: '删除帖子',
      content: '确定删除这条帖子吗？其中图片也会一并删除。',
      confirmText: '删除',
      confirmColor: '#e64340',
      success: async (r) => {
        if (!r.confirm) return
        try {
          wx.showLoading({ title: '删除中...', mask: true })
          const files = post.images || []
          await posts.doc(id).remove()
          if (files.length) await wx.cloud.deleteFile({ fileList: files }).catch(() => {})
          wx.hideLoading()
          await Promise.all([this.loadMinePosts(), this.loadWall(), this.loadLikedCounts()])
          wx.showToast({ title: '已删除', icon: 'success' })
        } catch (err) {
          console.error(err)
          wx.hideLoading()
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },

  // 相册长按删除照片
  onWallDelete(e) {
    const wid = e.currentTarget.dataset.id
    const url = e.currentTarget.dataset.url
    wx.showActionSheet({
      itemList: ['删除该照片'],
      itemColor: '#e64340',
      success: async (r) => {
        if (r.tapIndex !== 0) return
        try {
          await photos.doc(wid).remove()
          if (url) await wx.cloud.deleteFile({ fileList: [url] }).catch(() => {})
          await this.loadWall()
          wx.showToast({ title: '已删除', icon: 'success' })
        } catch (err) {
          console.error(err)
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },

  // 我的喜欢 / 我的收藏 数量(当前身份点赞/收藏过的帖子数)
  async loadLikedCounts() {
    if (!this.data.profile) return
    try {
      const key = await util.getLikeKey()
      const [likeRes, favRes] = await Promise.all([
        posts.where({ likedBy: key }).count(),
        posts.where({ favedBy: key }).count()
      ])
      this.setData({
        stat: Object.assign({}, this.data.stat, { likeSum: likeRes.total, favSum: favRes.total })
      })
    } catch (err) {
      console.error(err)
    }
  },

  preview(e) {
    const url = e.currentTarget.dataset.url
    const id = e.currentTarget.dataset.id
    const post = this.data.myPosts.find((p) => p._id === id) || {}
    wx.previewImage({ current: url, urls: post.images || [url] })
  },

  async onLike(e) {
    const id = e.currentTarget.dataset.id
    const i = this.data.myPosts.findIndex((p) => p._id === id)
    if (i < 0) return
    const p = this.data.myPosts[i]
    try {
      const key = await util.getLikeKey()
      const updated = await util.interact(id, p.liked ? 'unlike' : 'like', key)
      this.setData({ ['myPosts[' + i + ']']: this.decorate(updated) })
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  async onFav(e) {
    if (!util.isLogin()) return wx.showToast({ title: '请先登录', icon: 'none' })
    const id = e.currentTarget.dataset.id
    const i = this.data.myPosts.findIndex((p) => p._id === id)
    if (i < 0) return
    const p = this.data.myPosts[i]
    try {
      const key = await util.getLikeKey()
      const updated = await util.interact(id, p.faved ? 'unfav' : 'fav', key)
      this.setData({ ['myPosts[' + i + ']']: this.decorate(updated) })
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  async onShare(e) {
    if (!util.isLogin()) return wx.showToast({ title: '请先登录', icon: 'none' })
    const id = e.currentTarget.dataset.id
    const i = this.data.myPosts.findIndex((p) => p._id === id)
    if (i < 0) return
    try {
      const updated = await util.interact(id, 'share', await util.getLikeKey())
      this.setData({ ['myPosts[' + i + ']']: this.decorate(updated) })
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
      const post = this.data.myPosts.find((p) => p._id === id)
      return {
        title: (post ? post.nickName || '' : '') + ' 分享了一条动态，快来看看',
        path: '/pages/detail/detail?id=' + id
      }
    }
    return { title: '我的图片分享主页', path: '/pages/mine/mine' }
  }
})
