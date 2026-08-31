// pages/detail/detail.js
var common = require('../../utils/common.js')
var store = require('../../utils/store.js')
Page({

  /**
   * 页面的初始数据
   */
  data: {
    article: null, //当前新闻（为空时展示空状态）
    isAdd: false,  //是否已收藏
    isLike: false, //是否已点赞
    likeCount: 0,  //点赞数
    viewCount: 0,  //浏览数
    userType: 'anon', //当前身份：wx=微信登录 / anon=未登录
    commentList: [], //评论列表
    commentCount: 0, //评论数量
    commentInput: '' //评论输入内容
  },

  // 获取当前身份类型：wx=微信登录 / anon=未登录
  getUserType: function () {
    let session = wx.getStorageSync('wxSession')
    return (session && session.code) ? 'wx' : 'anon'
  },

  // 浏览数缓存 key（与首页保持一致）
  viewStorageKey: 'newsViews',
  // 浏览历史缓存 key
  historyStorageKey: 'newsViewHistory',

  // 浏览数 +1，并写入浏览历史（每次进入详情页记一次浏览）
  addView: function (article) {
    let id = article.id
    // 浏览数 +1
    let views = wx.getStorageSync(this.viewStorageKey)
    if (!views || typeof views !== 'object') {
      views = {}
    }
    views[id] = (views[id] || 0) + 1
    wx.setStorageSync(this.viewStorageKey, views)
    // 浏览历史：最新在前，重复浏览移到最前并更新时间，最多保留 50 条
    let history = wx.getStorageSync(this.historyStorageKey)
    if (!Array.isArray(history)) {
      history = []
    }
    let record = {
      id: article.id,
      title: article.title,
      poster: article.poster || '',
      add_date: article.add_date || '',
      viewTime: Date.now()
    }
    history = history.filter(function (item) {
      return item.id !== id
    })
    history.unshift(record)
    if (history.length > 50) {
      history = history.slice(0, 50)
    }
    wx.setStorageSync(this.historyStorageKey, history)
    return views[id]
  },

  // 点赞 / 取消点赞
  toggleLike: function () {
    let article = this.data.article
    if (!article || !article.id) {
      wx.showToast({
        title: '文章数据异常，请重试',
        icon: 'none'
      })
      return
    }
    // 未登录不能点赞
    if (this.getUserType() === 'anon') {
      wx.showToast({
        title: '请先登录后再点赞',
        icon: 'none'
      })
      return
    }
    let that = this
    store.toggleLike(article.id, this.getUserType()).then(function (res) {
      if (!res || !res.ok) {
        wx.showToast({
          title: '操作失败，请重试',
          icon: 'none'
        })
        return
      }
      that.setData({
        isLike: res.liked,
        likeCount: res.count
      })
      wx.showToast({
        title: res.liked ? '点赞成功' : '已取消点赞',
        icon: 'none',
        duration: 1200
      })
    })
  },
  //添加收藏
  addFavorites: function () {
    // 仅微信登录用户可收藏
    let type = this.getUserType()
    if (type !== 'wx') {
      wx.showToast({
        title: '请先登录后再收藏',
        icon: 'none'
      })
      return
    }
    let article = this.data.article
    //边界处理：文章未加载成功时禁止收藏
    if (!article || !article.id) {
      wx.showToast({
        title: '文章数据异常，请重试',
        icon: 'none'
      })
      return
    }
    wx.setStorageSync(article.id, article)
    this.setData({
      isAdd: true
    })
    wx.showToast({
      title: '收藏成功',
      icon: 'success'
    })
  },
  //取消收藏
  cancelFavorites: function () {
    let article = this.data.article
    //边界处理：文章未加载成功时禁止取消收藏
    if (!article || !article.id) {
      wx.showToast({
        title: '文章数据异常，请重试',
        icon: 'none'
      })
      return
    }
    wx.removeStorageSync(article.id)
    this.setData({
      isAdd: false
    })
    wx.showToast({
      title: '已取消收藏',
      icon: 'none'
    })
  },
  // 加载某条新闻的评论列表（云优先，云不可用时读本地缓存）
  loadComments: function (id) {
    let that = this
    store.getComments(id).then(function (list) {
      that.setData({
        commentList: list,
        commentCount: list.length
      })
    })
  },
  // 评论输入
  onCommentInput: function (e) {
    this.setData({
      commentInput: e.detail.value
    })
  },
  // 发表评论
  submitComment: function () {
    // 仅微信登录用户可评论
    let type = this.getUserType()
    if (type !== 'wx') {
      wx.showToast({
        title: '请先登录后再评论',
        icon: 'none'
      })
      return
    }
    let id = this.data.article ? this.data.article.id : ''
    if (!id) {
      wx.showToast({
        title: '文章数据异常，请重试',
        icon: 'none'
      })
      return
    }
    let content = (this.data.commentInput || '').trim()
    if (!content) {
      wx.showToast({
        title: '评论内容不能为空',
        icon: 'none'
      })
      return
    }
    // 取微信昵称与头像（云/本地存储评论时使用）
    let userInfo = wx.getStorageSync('wxUserInfo') || {}
    let nickName = userInfo.nickName || '微信用户'
    let src = userInfo.src || ''
    let that = this
    store.addComment(id, {
      content: content,
      nickName: nickName,
      src: src
    }).then(function () {
      that.setData({
        commentInput: ''
      })
      that.loadComments(id)
      wx.showToast({
        title: '评论成功',
        icon: 'success'
      })
    })
  },
  // 删除自己的评论
  deleteComment: function (e) {
    let id = this.data.article ? this.data.article.id : ''
    let cid = e.currentTarget.dataset.id
    let that = this
    wx.showModal({
      title: '提示',
      content: '确定删除这条评论吗？',
      success: function (res) {
        if (res.confirm) {
          store.deleteComment(cid).then(function (ok) {
            if (ok) {
              that.loadComments(id)
              wx.showToast({
                title: '已删除',
                icon: 'none'
              })
            } else {
              wx.showToast({
                title: '删除失败，请重试',
                icon: 'none'
              })
            }
          })
        }
      }
    })
  },
  /**
   * 生命周期函数--监听页面加载
   */
   onLoad: function (options) {
    //边界处理：缺少 id 参数时直接返回，避免后续渲染/收藏报错
    if( !options || !options.id ){
      return
    }
    //清理旧版点赞/浏览缓存（历史假数据），确保从零开始
    wx.removeStorageSync('newsLikeData')
    wx.removeStorageSync('newsViewData')
    // 清理旧版全局点赞缓存（新版按身份隔离）
    wx.removeStorageSync('newsLikes')
    let id = options.id
    // 获取当前身份：wx=微信登录 / anon=未登录
    let userType = this.getUserType()
    this.setData({ userType: userType })

    // 确定文章内容：优先读收藏缓存，否则查新闻数据源
    let article = null
    let isAdd = false
    var newarticle = wx.getStorageSync(id)
    if (newarticle && newarticle.id) {
      article = newarticle
      isAdd = userType === 'wx' ? true : false
    } else {
      let result = common.getNewsDetail(id)
      if (result.code === '200') {
        article = result.news
      } else {
        //未找到对应新闻，给出提示
        wx.showToast({
          title: '新闻不存在',
          icon: 'none'
        })
        return
      }
    }
    let viewCount = this.addView(article)
    this.setData({
      article: article,
      isAdd: isAdd,
      viewCount: viewCount
    })
    wx.setNavigationBarTitle({ title: article.title })

    // 异步加载点赞状态（云优先，云不可用时回退本地）
    let that = this
    store.fetchLikeState(id, userType).then(function (like) {
      that.setData({
        isLike: like.liked,
        likeCount: like.count
      })
    })
    this.loadComments(id)
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    let article = this.data.article
    return {
      title: article ? article.title : '海大新闻网',
      path: '/pages/detail/detail?id=' + (article ? article.id : '')
    }
  }
})