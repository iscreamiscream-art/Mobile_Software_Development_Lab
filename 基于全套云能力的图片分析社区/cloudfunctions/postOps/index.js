// 云函数 postOps
// 负责帖子的点赞 / 取消点赞 / 收藏 / 取消收藏 / 分享计数
// 点赞/收藏使用“身份 key”标识：
//   - 登录用户: u_<openid>
//   - 游客:     g_<游客本地会话id>
// 这样登录态与游客态互看不到彼此的点赞记录(数据不互通)，
// 但数组长度(即点赞总数)仍为同一份，故总数互通。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event) => {
  const postId = event.postId
  const action = event.action // like | unlike | fav | unfav | share
  let userKey = event.userKey

  if (!postId || !action) {
    return { ok: false, msg: '缺少参数' }
  }

  // 兼容旧调用：未传 userKey 时退回用 openid 作身份
  if (!userKey) {
    const wxContext = cloud.getWXContext()
    userKey = wxContext.OPENID
  }

  const col = db.collection('posts')

  if (action === 'like' || action === 'unlike') {
    await col.doc(postId).update({
      data: {
        likedBy: action === 'like' ? db.command.addToSet(userKey) : db.command.pull(userKey)
      }
    })
  } else if (action === 'fav' || action === 'unfav') {
    await col.doc(postId).update({
      data: {
        favedBy: action === 'fav' ? db.command.addToSet(userKey) : db.command.pull(userKey)
      }
    })
  } else if (action === 'share') {
    await col.doc(postId).update({
      data: {
        shareCount: db.command.inc(1)
      }
    })
  } else if (action === 'view') {
    // 浏览量无需区分身份，打开一次 +1
    await col.doc(postId).update({
      data: {
        viewCount: db.command.inc(1)
      }
    })
  }

  // 读取并返回最新帖子，供前端即时刷新
  const res = await col.doc(postId).get()
  const post = res.data
  if (post.likedBy) post.likeCount = post.likedBy.length
  if (post.favedBy) post.favCount = post.favedBy.length
  post.shareCount = post.shareCount || 0
  post.viewCount = post.viewCount || 0
  post.liked = (post.likedBy || []).indexOf(userKey) > -1
  post.faved = (post.favedBy || []).indexOf(userKey) > -1

  return { ok: true, post }
}
