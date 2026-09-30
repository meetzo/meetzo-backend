import {
  getMatchesService,
  getMatchStatusService,
  getMatchCountService,
  getMatchUserDetailsService
} from "./matches.services.js";



export const getMatchesController =
  async (
    req,
    res,
    next
  ) => {
    try {
      const userId =
        req.user._id;

      const {
        page = 1,
        limit = 20,
      } = req.query;

      const result =
        await getMatchesService({
          userId,
          page,
          limit,
        });

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Matches fetched successfully",

          data:
            result.data,

          pagination:
            result.pagination,
        });
    } catch (error) {
      next(error);
    }
  };

/**
 * -------------------------------------------------------
 * CHECK MATCH STATUS
 * -------------------------------------------------------
 */
export const getMatchStatusController =
  async (
    req,
    res,
    next
  ) => {
    try {
      const userId =
        req.user._id;

      const {
        userId:
          targetUserId,
      } = req.params;

      const result =
        await getMatchStatusService({
          userId,
          targetUserId,
        });

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Match status fetched successfully",

          data:
            result,
        });
    } catch (error) {
      next(error);
    }
  };

/**
 * -------------------------------------------------------
 * GET MATCH COUNT
 * -------------------------------------------------------
 */
export const getMatchCountController =
  async (
    req,
    res,
    next
  ) => {
    try {
      const userId =
        req.user._id;

      const result =
        await getMatchCountService({
          userId,
        });

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Match count fetched successfully",

          data:
            result,
        });
    } catch (error) {
      next(error);
    }
  };


  // likes.controller.js

// export const getMatchUserDetailsController = async (
//   req,
//   res,
//   next
// ) => {
//   try {
//     const fromUserId =
//       req.user._id;

//     const {
//       userId: toUserId,
//     } = req.params;

//     const result =
//       await getMatchUserDetailsService({
//         fromUserId,
//         toUserId,
//       });

//     return res.status(200).json({
//       success: true,
//       message:
//         "Liked user details fetched successfully",
//       data: result,
//     });
//   } catch (error) {
//     next(error);
//   }
// };


export const getMatchUserDetailsController = async (req, res, next) => {
  try {
    const fromUserId = req.user?._id;
    const toUserId = req.params?.userId;

    console.log("fromUserId:", fromUserId);
    console.log("toUserId:", toUserId);
    console.log("params:", req.params);

    const result = await getMatchUserDetailsService({
      fromUserId,
      toUserId,
    });

    return res.status(200).json({
      success: true,
      message: "Matched user details fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};