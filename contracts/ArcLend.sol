// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title ArcLend
/// @notice Unaudited demo software: a small multi-asset money market for Arc Testnet (5042002).
/// @dev Prices are owner-set testnet reference prices, NOT an external oracle feed.
/// Intended assets are USDC (0x3600000000000000000000000000000000000000) and
/// EURC (0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a), both with 6 decimals.
/// All assets, including Arc's native USDC, are accessed ONLY through ERC-20 interfaces.
/// No native deposits, reserve factor, receipt tokens, proxies, or bad-debt socialization.
/// Only standard, non-rebasing, exact-transfer ERC-20 tokens should be listed.
contract ArcLend is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant RAY = 1e27;
    uint256 public constant WAD = 1e18;
    uint256 public constant BPS = 10_000;
    uint256 public constant YEAR = 365 days;
    uint256 public constant MAX_RESERVES = 8;
    uint256 public constant CLOSE_FACTOR_BPS = 5_000;

    struct Reserve {
        address token;
        uint8 decimals;
        bool active;
        bool frozen;
        uint256 ltvBps;
        uint256 liquidationThresholdBps;
        uint256 liquidationBonusBps;
        uint256 priceUsd8;
        uint256 supplyCap;
        uint256 borrowCap;
        uint256 liquidityIndex;
        uint256 borrowIndex;
        uint256 lastUpdateTimestamp;
        uint256 totalScaledSupply;
        uint256 totalScaledBorrow;
        uint256 baseRateBps;
        uint256 slope1Bps;
        uint256 slope2Bps;
        uint256 optimalUtilBps;
    }

    struct Position {
        uint256 scaledSupply;
        uint256 scaledBorrow;
        bool collateralEnabled;
    }

    struct ReserveData {
        address token;
        uint8 decimals;
        uint256 ltvBps;
        uint256 liquidationThresholdBps;
        uint256 liquidationBonusBps;
        uint256 priceUsd8;
        uint256 totalSupply;
        uint256 totalBorrow;
        uint256 availableLiquidity;
        uint256 supplyCap;
        uint256 borrowCap;
        uint256 supplyRateBps;
        uint256 borrowRateBps;
        uint256 utilizationBps;
        bool frozen;
        bool active;
        uint256 liquidityIndex;
        uint256 borrowIndex;
        uint256 lastUpdateTimestamp;
        uint256 totalScaledSupply;
        uint256 totalScaledBorrow;
        uint256 baseRateBps;
        uint256 slope1Bps;
        uint256 slope2Bps;
        uint256 optimalUtilBps;
    }

    struct Account {
        uint256 collateral;
        uint256 debt;
        uint256 ltvValue;
        uint256 liquidationValue;
    }

    struct LiquidationAmounts {
        uint256 debtCovered;
        uint256 collateralSeized;
        uint256 debtShares;
        uint256 collateralShares;
    }

    mapping(address => Reserve) private _reserves;
    mapping(address => mapping(address => Position)) private _positions;
    address[] private _reserveList;

    error InvalidToken();
    error ReserveNotListed();
    error ReserveAlreadyListed();
    error TooManyReserves();
    error InvalidConfiguration();
    error InvalidAmount();
    error ReserveUnavailable();
    error CapExceeded();
    error InsufficientLiquidity();
    error InsufficientSupply();
    error InsufficientCollateral();
    error UnhealthyPosition();
    error PositionHealthy();
    error CollateralNotEnabled();
    error UnsupportedTransfer();
    error InvalidPrice();
    error PriceChangeTooLarge();

    event Supply(address indexed user, address indexed token, uint256 amount);
    event Withdraw(address indexed user, address indexed token, uint256 amount);
    event Borrow(address indexed user, address indexed token, uint256 amount);
    event Repay(address indexed user, address indexed token, uint256 amount);
    event Liquidation(
        address indexed liquidator,
        address indexed user,
        address indexed collateralToken,
        address debtToken,
        uint256 debtCovered,
        uint256 collateralSeized
    );
    event CollateralToggled(address indexed user, address indexed token, bool enabled);
    event PriceUpdated(address indexed token, uint256 oldPrice, uint256 newPrice);
    event ReserveAdded(address indexed token);
    event ReserveActiveUpdated(address indexed token, bool active);
    event ReserveFrozenUpdated(address indexed token, bool frozen);
    event CapsUpdated(address indexed token, uint256 supplyCap, uint256 borrowCap);

    /// @param initialOwner Administrative wallet.
    /// @param tokens Assets listed at deployment, with no supply or borrow caps.
    /// @param pricesUsd8 Initial owner-set reference prices (8 decimals), one per token.
    /// @param ltvsBps Max loan-to-value per token.
    /// @param thresholdsBps Liquidation threshold per token.
    /// @param bonusesBps Liquidation bonus per token.
    constructor(
        address initialOwner,
        address[] memory tokens,
        uint256[] memory pricesUsd8,
        uint256[] memory ltvsBps,
        uint256[] memory thresholdsBps,
        uint256[] memory bonusesBps
    ) Ownable(initialOwner) {
        uint256 n = tokens.length;
        if (
            n != pricesUsd8.length || n != ltvsBps.length || n != thresholdsBps.length || n != bonusesBps.length
        ) revert InvalidConfiguration();
        for (uint256 i = 0; i < n; i++) {
            _addReserve(tokens[i], ltvsBps[i], thresholdsBps[i], bonusesBps[i], 0, 0, pricesUsd8[i]);
        }
    }

    function addReserve(
        address token,
        uint256 ltvBps,
        uint256 liquidationThresholdBps,
        uint256 liquidationBonusBps,
        uint256 supplyCap,
        uint256 borrowCap,
        uint256 priceUsd8
    ) external onlyOwner nonReentrant {
        _addReserve(token, ltvBps, liquidationThresholdBps, liquidationBonusBps, supplyCap, borrowCap, priceUsd8);
    }

    function _addReserve(
        address token,
        uint256 ltvBps,
        uint256 liquidationThresholdBps,
        uint256 liquidationBonusBps,
        uint256 supplyCap,
        uint256 borrowCap,
        uint256 priceUsd8
    ) private {
        if (token == address(0) || token.code.length == 0) revert InvalidToken();
        if (_reserves[token].token != address(0)) revert ReserveAlreadyListed();
        if (_reserveList.length >= MAX_RESERVES) revert TooManyReserves();
        if (ltvBps >= liquidationThresholdBps || liquidationThresholdBps >= BPS) {
            revert InvalidConfiguration();
        }
        // Equivalent to threshold * (BPS + bonus) <= BPS squared, without overflow.
        if (liquidationBonusBps > (BPS * BPS) / liquidationThresholdBps - BPS) {
            revert InvalidConfiguration();
        }
        if (priceUsd8 == 0) revert InvalidPrice();
        uint8 decimals = IERC20Metadata(token).decimals();
        if (decimals > 18) revert InvalidConfiguration();
        _accrueAll();
        Reserve storage r = _reserves[token];
        r.token = token;
        r.decimals = decimals;
        r.active = true;
        r.ltvBps = ltvBps;
        r.liquidationThresholdBps = liquidationThresholdBps;
        r.liquidationBonusBps = liquidationBonusBps;
        r.priceUsd8 = priceUsd8;
        r.supplyCap = supplyCap;
        r.borrowCap = borrowCap;
        r.liquidityIndex = RAY;
        r.borrowIndex = RAY;
        r.lastUpdateTimestamp = block.timestamp;
        r.baseRateBps = 0;
        r.slope1Bps = 400;
        r.slope2Bps = 6_000;
        r.optimalUtilBps = 8_000;
        _reserveList.push(token);
        emit ReserveAdded(token);
    }

    /// @notice No time interval restriction; each individual change is bounded by 10%.
    function setPrice(address token, uint256 priceUsd8) external onlyOwner nonReentrant {
        Reserve storage r = _reserve(token);
        if (priceUsd8 == 0) revert InvalidPrice();
        uint256 oldPrice = r.priceUsd8;
        uint256 delta = priceUsd8 > oldPrice ? priceUsd8 - oldPrice : oldPrice - priceUsd8;
        if (delta > oldPrice / 10) revert PriceChangeTooLarge();
        _accrue(r);
        r.priceUsd8 = priceUsd8;
        emit PriceUpdated(token, oldPrice, priceUsd8);
    }

    /// @dev Inactive, like frozen, blocks new supply/borrow but never blocks exits or liquidation.
    function setReserveActive(address token, bool active) external onlyOwner nonReentrant {
        Reserve storage r = _reserve(token);
        _accrue(r);
        r.active = active;
        emit ReserveActiveUpdated(token, active);
    }

    function setReserveFrozen(address token, bool frozen) external onlyOwner nonReentrant {
        Reserve storage r = _reserve(token);
        _accrue(r);
        r.frozen = frozen;
        emit ReserveFrozenUpdated(token, frozen);
    }

    /// @dev A cap below existing balances prevents growth; it does not force repayment/withdrawal.
    function setCaps(address token, uint256 supplyCap, uint256 borrowCap) external onlyOwner nonReentrant {
        Reserve storage r = _reserve(token);
        _accrue(r);
        r.supplyCap = supplyCap;
        r.borrowCap = borrowCap;
        emit CapsUpdated(token, supplyCap, borrowCap);
    }

    function supply(address token, uint256 amount) external nonReentrant {
        Reserve storage r = _reserve(token);
        _requireOpen(r);
        if (amount == 0) revert InvalidAmount();
        _accrueAll();
        uint256 shares = Math.mulDiv(amount, RAY, r.liquidityIndex);
        if (shares == 0) revert InvalidAmount();
        if (
            r.supplyCap != 0
                && _supplyUnderlying(r.totalScaledSupply, r.liquidityIndex) + amount > r.supplyCap
        ) revert CapExceeded();
        Position storage p = _positions[msg.sender][token];
        bool firstSupply = p.scaledSupply == 0;
        p.scaledSupply += shares;
        r.totalScaledSupply += shares;
        if (firstSupply && !p.collateralEnabled) {
            p.collateralEnabled = true;
            emit CollateralToggled(msg.sender, token, true);
        }
        _pullExact(token, msg.sender, amount);
        emit Supply(msg.sender, token, amount);
    }

    /// @notice The max sentinel withdraws the full claim, or reverts; it does not partially withdraw.
    function withdraw(address token, uint256 amount) external nonReentrant {
        Reserve storage r = _reserve(token);
        _accrueAll();
        Position storage p = _positions[msg.sender][token];
        uint256 supplied = _supplyUnderlying(p.scaledSupply, r.liquidityIndex);
        if (amount == type(uint256).max) amount = supplied;
        if (amount == 0) revert InvalidAmount();
        if (amount > supplied) revert InsufficientSupply();
        if (IERC20(token).balanceOf(address(this)) < amount) revert InsufficientLiquidity();
        uint256 shares = amount == supplied
            ? p.scaledSupply
            : Math.mulDiv(amount, RAY, r.liquidityIndex, Math.Rounding.Ceil);
        p.scaledSupply -= shares;
        r.totalScaledSupply -= shares;
        _requireHealthy(msg.sender);
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdraw(msg.sender, token, amount);
    }

    function borrow(address token, uint256 amount) external nonReentrant {
        Reserve storage r = _reserve(token);
        _requireOpen(r);
        if (amount == 0) revert InvalidAmount();
        _accrueAll();
        if (IERC20(token).balanceOf(address(this)) < amount) revert InsufficientLiquidity();
        uint256 shares = Math.mulDiv(amount, RAY, r.borrowIndex, Math.Rounding.Ceil);
        _positions[msg.sender][token].scaledBorrow += shares;
        r.totalScaledBorrow += shares;
        if (r.borrowCap != 0 && _debtUnderlying(r.totalScaledBorrow, r.borrowIndex) > r.borrowCap) {
            revert CapExceeded();
        }
        Account memory a = _account(msg.sender);
        if (a.debt > a.ltvValue) revert InsufficientCollateral();
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Borrow(msg.sender, token, amount);
    }

    /// @notice Pulls at most the current rounded-up debt; partial repayment burns shares down.
    function repay(address token, uint256 amount) external nonReentrant {
        Reserve storage r = _reserve(token);
        if (amount == 0) revert InvalidAmount();
        _accrueAll();
        Position storage p = _positions[msg.sender][token];
        uint256 debt = _debtUnderlying(p.scaledBorrow, r.borrowIndex);
        amount = Math.min(amount, debt);
        if (amount == 0) revert InvalidAmount();
        uint256 shares = amount == debt ? p.scaledBorrow : Math.mulDiv(amount, RAY, r.borrowIndex);
        if (shares == 0) revert InvalidAmount();
        p.scaledBorrow -= shares;
        r.totalScaledBorrow -= shares;
        _pullExact(token, msg.sender, amount);
        emit Repay(msg.sender, token, amount);
    }

    function setCollateral(address token, bool enabled) external nonReentrant {
        _reserve(token);
        _accrueAll();
        _positions[msg.sender][token].collateralEnabled = enabled;
        if (!enabled) _requireHealthy(msg.sender);
        emit CollateralToggled(msg.sender, token, enabled);
    }

    /// @notice Covers at most 50% of the selected debt reserve's debt, limited by collateral.
    /// @dev Dust that cannot burn a debt share or seize one underlying unit reverts.
    function liquidate(address collateralToken, address debtToken, address user, uint256 debtToCover)
        external
        nonReentrant
    {
        Reserve storage c = _reserve(collateralToken);
        Reserve storage d = _reserve(debtToken);
        if (debtToCover == 0) revert InvalidAmount();
        _accrueAll();
        Account memory a = _account(user);
        if (a.debt == 0 || a.liquidationValue >= a.debt) revert PositionHealthy();
        if (!_positions[user][collateralToken].collateralEnabled) revert CollateralNotEnabled();
        LiquidationAmounts memory q = _liquidationAmounts(c, d, user, debtToCover);
        bool payout = IERC20(collateralToken).balanceOf(address(this)) >= q.collateralSeized;
        _positions[user][debtToken].scaledBorrow -= q.debtShares;
        d.totalScaledBorrow -= q.debtShares;
        _positions[user][collateralToken].scaledSupply -= q.collateralShares;
        if (payout) {
            c.totalScaledSupply -= q.collateralShares;
        } else {
            // Pool cash is lent out: hand the liquidator the supply position instead, so liquidation never stalls.
            _positions[msg.sender][collateralToken].scaledSupply += q.collateralShares;
        }
        _pullExact(debtToken, msg.sender, q.debtCovered);
        if (payout) IERC20(collateralToken).safeTransfer(msg.sender, q.collateralSeized);
        emit Liquidation(msg.sender, user, collateralToken, debtToken, q.debtCovered, q.collateralSeized);
    }

    function getReserveList() external view returns (address[] memory) {
        return _reserveList;
    }

    function getReserveData(address token) external view returns (ReserveData memory data) {
        Reserve storage r = _reserve(token);
        (uint256 li, uint256 bi) = _previewIndices(r);
        data.token = token;
        data.decimals = r.decimals;
        data.ltvBps = r.ltvBps;
        data.liquidationThresholdBps = r.liquidationThresholdBps;
        data.liquidationBonusBps = r.liquidationBonusBps;
        data.priceUsd8 = r.priceUsd8;
        data.totalSupply = _supplyUnderlying(r.totalScaledSupply, li);
        data.totalBorrow = _debtUnderlying(r.totalScaledBorrow, bi);
        data.availableLiquidity = IERC20(token).balanceOf(address(this));
        data.supplyCap = r.supplyCap;
        data.borrowCap = r.borrowCap;
        (data.supplyRateBps, data.borrowRateBps, data.utilizationBps) =
            _rates(r, data.totalBorrow, data.availableLiquidity);
        data.frozen = r.frozen;
        data.active = r.active;
        data.liquidityIndex = li;
        data.borrowIndex = bi;
        data.lastUpdateTimestamp = r.lastUpdateTimestamp;
        data.totalScaledSupply = r.totalScaledSupply;
        data.totalScaledBorrow = r.totalScaledBorrow;
        data.baseRateBps = r.baseRateBps;
        data.slope1Bps = r.slope1Bps;
        data.slope2Bps = r.slope2Bps;
        data.optimalUtilBps = r.optimalUtilBps;
    }

    function getUserReserveData(address token, address user)
        external
        view
        returns (uint256 supplied, uint256 borrowed, bool collateralEnabled)
    {
        Reserve storage r = _reserve(token);
        (uint256 li, uint256 bi) = _previewIndices(r);
        Position storage p = _positions[user][token];
        return (
            _supplyUnderlying(p.scaledSupply, li),
            _debtUnderlying(p.scaledBorrow, bi),
            p.collateralEnabled
        );
    }

    function getUserAccount(address user)
        external
        view
        returns (
            uint256 totalCollateralUsd8,
            uint256 totalDebtUsd8,
            uint256 borrowCapacityUsd8,
            uint256 healthFactorWad
        )
    {
        Account memory a = _account(user);
        return (
            a.collateral,
            a.debt,
            a.ltvValue > a.debt ? a.ltvValue - a.debt : 0,
            a.debt == 0 ? type(uint256).max : Math.mulDiv(a.liquidationValue, WAD, a.debt)
        );
    }

    function _reserve(address token) private view returns (Reserve storage r) {
        r = _reserves[token];
        if (r.token == address(0)) revert ReserveNotListed();
    }

    function _requireOpen(Reserve storage r) private view {
        if (!r.active || r.frozen) revert ReserveUnavailable();
    }

    function _requireHealthy(address user) private view {
        Account memory a = _account(user);
        if (a.debt > a.liquidationValue) revert UnhealthyPosition();
    }

    function _account(address user) private view returns (Account memory a) {
        for (uint256 i; i < _reserveList.length; ++i) {
            Reserve storage r = _reserves[_reserveList[i]];
            Position storage p = _positions[user][r.token];
            if (p.scaledSupply == 0 && p.scaledBorrow == 0) continue;
            (uint256 li, uint256 bi) = _previewIndices(r);
            uint256 unit = 10 ** uint256(r.decimals);
            a.debt += Math.mulDiv(
                _debtUnderlying(p.scaledBorrow, bi), r.priceUsd8, unit, Math.Rounding.Ceil
            );
            if (p.collateralEnabled) {
                uint256 value = Math.mulDiv(_supplyUnderlying(p.scaledSupply, li), r.priceUsd8, unit);
                a.collateral += value;
                a.ltvValue += Math.mulDiv(value, r.ltvBps, BPS);
                a.liquidationValue += Math.mulDiv(value, r.liquidationThresholdBps, BPS);
            }
        }
    }

    function _accrueAll() private {
        for (uint256 i; i < _reserveList.length; ++i) {
            _accrue(_reserves[_reserveList[i]]);
        }
    }

    function _accrue(Reserve storage r) private {
        (r.liquidityIndex, r.borrowIndex) = _previewIndices(r);
        r.lastUpdateTimestamp = block.timestamp;
    }

    /// @dev Linear per-second accrual within an interval; indices compound across updates.
    /// Supply interest rounds down, debt interest up. Zero-debt periods do not accrue.
    function _previewIndices(Reserve storage r) private view returns (uint256 li, uint256 bi) {
        li = r.liquidityIndex;
        bi = r.borrowIndex;
        uint256 elapsed = block.timestamp - r.lastUpdateTimestamp;
        if (elapsed == 0 || r.totalScaledBorrow == 0) return (li, bi);
        (uint256 supplyRate, uint256 borrowRate,) = _rates(
            r, _debtUnderlying(r.totalScaledBorrow, bi), IERC20(r.token).balanceOf(address(this))
        );
        li += Math.mulDiv(li, supplyRate * elapsed, BPS * YEAR);
        bi += Math.mulDiv(bi, borrowRate * elapsed, BPS * YEAR, Math.Rounding.Ceil);
    }

    function _rates(Reserve storage r, uint256 debt, uint256 cash)
        private
        view
        returns (uint256 supplyRateBps, uint256 borrowRateBps, uint256 utilizationBps)
    {
        utilizationBps = debt == 0 ? 0 : Math.mulDiv(debt, BPS, cash + debt);
        if (utilizationBps <= r.optimalUtilBps) {
            borrowRateBps = r.baseRateBps + Math.mulDiv(r.slope1Bps, utilizationBps, r.optimalUtilBps);
        } else {
            borrowRateBps = r.baseRateBps + r.slope1Bps
                + Math.mulDiv(r.slope2Bps, utilizationBps - r.optimalUtilBps, BPS - r.optimalUtilBps);
        }
        supplyRateBps = Math.mulDiv(borrowRateBps, utilizationBps, BPS);
    }

    function _supplyUnderlying(uint256 shares, uint256 index) private pure returns (uint256) {
        return Math.mulDiv(shares, index, RAY);
    }

    function _debtUnderlying(uint256 shares, uint256 index) private pure returns (uint256) {
        return Math.mulDiv(shares, index, RAY, Math.Rounding.Ceil);
    }

    function _liquidationAmounts(Reserve storage c, Reserve storage d, address user, uint256 requested)
        private
        view
        returns (LiquidationAmounts memory q)
    {
        Position storage cp = _positions[user][c.token];
        Position storage dp = _positions[user][d.token];
        uint256 collateral = _supplyUnderlying(cp.scaledSupply, c.liquidityIndex);
        uint256 debt = _debtUnderlying(dp.scaledBorrow, d.borrowIndex);
        q.debtCovered = Math.min(requested, Math.mulDiv(debt, CLOSE_FACTOR_BPS, BPS));
        // Convert collateral to the largest conservatively affordable debt-token payment.
        uint256 collateralUsd = Math.mulDiv(collateral, c.priceUsd8, 10 ** uint256(c.decimals));
        uint256 baseUsd = Math.mulDiv(collateralUsd, BPS, BPS + c.liquidationBonusBps);
        uint256 affordableDebt = Math.mulDiv(baseUsd, 10 ** uint256(d.decimals), d.priceUsd8);
        q.debtCovered = Math.min(q.debtCovered, affordableDebt);
        q.debtShares = Math.mulDiv(q.debtCovered, RAY, d.borrowIndex);
        if (q.debtShares == 0) revert InvalidAmount();
        q.collateralSeized = Math.min(collateral, _seizeAmount(c, d, q.debtCovered));
        if (q.collateralSeized == 0) revert InvalidAmount();
        q.collateralShares = q.collateralSeized == collateral
            ? cp.scaledSupply
            : Math.mulDiv(q.collateralSeized, RAY, c.liquidityIndex, Math.Rounding.Ceil);
    }

    function _seizeAmount(Reserve storage c, Reserve storage d, uint256 debtCovered) private view returns (uint256) {
        uint256 debtUsd = Math.mulDiv(debtCovered, d.priceUsd8, 10 ** uint256(d.decimals));
        uint256 seizeUsd = Math.mulDiv(debtUsd, BPS + c.liquidationBonusBps, BPS);
        return Math.mulDiv(seizeUsd, 10 ** uint256(c.decimals), c.priceUsd8);
    }

    /// @dev Also reject short repayment/liquidation transfers, not just short supply transfers.
    /// This interaction follows all position effects; a mismatch atomically reverts those effects.
    function _pullExact(address token, address from, uint256 amount) private {
        uint256 beforeBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(from, address(this), amount);
        uint256 afterBalance = IERC20(token).balanceOf(address(this));
        if (afterBalance < beforeBalance || afterBalance - beforeBalance != amount) revert UnsupportedTransfer();
    }
}
