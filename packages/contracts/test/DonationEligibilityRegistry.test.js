const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DonationEligibilityRegistry", function () {
  let registry;
  let owner;
  let hospital;
  let unauthorized;
  const donorHash = ethers.keccak256(ethers.toUtf8Bytes("donor-pseudonym-uuid-001"));

  beforeEach(async function () {
    [owner, hospital, unauthorized] = await ethers.getSigners();

    const DonationEligibilityRegistry = await ethers.getContractFactory("DonationEligibilityRegistry");
    // Deploy with 56-day interval
    registry = await DonationEligibilityRegistry.deploy(56);
    await registry.waitForDeployment();

    // Authorize hospital
    await registry.setVerifier(hospital.address, true);
  });

  it("should deploy with 56-day min interval (4,838,400 seconds)", async function () {
    const minInterval = await registry.minIntervalSeconds();
    expect(minInterval).to.equal(56n * 86400n);
  });

  it("should allow first-time donor to check eligibility as satisfied", async function () {
    const [isSatisfied, nextEligible, totalDonations] = await registry.checkEligibility(donorHash);
    expect(isSatisfied).to.be.true;
    expect(totalDonations).to.equal(0n);
  });

  it("should allow authorized hospital to record donation", async function () {
    const now = Math.floor(Date.now() / 1000);
    await expect(registry.connect(hospital).recordDonation(donorHash, now))
      .to.emit(registry, "DonationRecorded")
      .withArgs(donorHash, now, hospital.address, 1n);

    const [isSatisfied, nextEligible, totalDonations] = await registry.checkEligibility(donorHash);
    expect(isSatisfied).to.be.false; // Immediately after donation, interval is not satisfied
    expect(totalDonations).to.equal(1n);
  });

  it("should reject donation recording from unauthorized callers", async function () {
    const now = Math.floor(Date.now() / 1000);
    await expect(
      registry.connect(unauthorized).recordDonation(donorHash, now)
    ).to.be.revertedWith("Caller is not an authorized healthcare verifier");
  });

  it("should reject a subsequent donation if interval has not elapsed", async function () {
    const now = Math.floor(Date.now() / 1000);
    await registry.connect(hospital).recordDonation(donorHash, now);

    // Try donating again 10 days later
    const tenDaysLater = now + 10 * 86400;
    // Fast forward EVM block timestamp
    await ethers.provider.send("evm_setNextBlockTimestamp", [tenDaysLater]);
    await ethers.provider.send("evm_mine");

    await expect(
      registry.connect(hospital).recordDonation(donorHash, tenDaysLater)
    ).to.be.revertedWith("Mandatory safety interval has not elapsed since previous donation");
  });

  it("should permit next donation once 56 days have elapsed", async function () {
    const now = Math.floor(Date.now() / 1000);
    await registry.connect(hospital).recordDonation(donorHash, now);

    // Fast forward 57 days
    const fiftySevenDaysLater = now + 57 * 86400;
    await ethers.provider.send("evm_setNextBlockTimestamp", [fiftySevenDaysLater]);
    await ethers.provider.send("evm_mine");

    const [isSatisfied] = await registry.checkEligibility(donorHash);
    expect(isSatisfied).to.be.true;

    // Recording second donation should succeed
    await expect(
      registry.connect(hospital).recordDonation(donorHash, fiftySevenDaysLater)
    ).to.emit(registry, "DonationRecorded");
  });
});
