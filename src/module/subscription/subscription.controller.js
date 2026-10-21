import {
  grantComplimentarySubscriptionService,
  getSubscriptionAccessService,
} from "./subscription.service.js";

export const createSubscriptionController = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;

    const subscription =
      await grantComplimentarySubscriptionService(userId);

    return res.status(200).json({
      success: true,
      message: "Subscription activated successfully",
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

export const getMySubscriptionController = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;

    const result = await getSubscriptionAccessService(userId);

    return res.status(200).json({
      success: true,
      message: "Subscription fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};