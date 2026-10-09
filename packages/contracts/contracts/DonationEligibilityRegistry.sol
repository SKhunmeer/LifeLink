// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DonationEligibilityRegistry
 * @dev Cryptographic trust layer for recording pseudonymous donor eligibility verification intervals.
 *
 * CRITICAL PRIVACY & CLINICAL COMPLIANCE:
 * 1. ONLY pseudonymous opaque identifiers (bytes32 keccak256 hash of donor UUID) are stored on-chain.
 *    NEVER store names, phone numbers, recipient identities, medical diagnosis, or PII on-chain.
 * 2. On-chain timestamps establish an immutable record that the mandatory recovery interval
 *    has elapsed. They do NOT replace licensed in-person clinical screening or laboratory cross-matching.
 * 3. Only pre-authorized accredited hospital and blood bank verifier addresses can submit records.
 */
contract DonationEligibilityRegistry {
    address public owner;
    uint256 public minIntervalSeconds; // Default 56 days (56 * 86400 = 4,838,400 seconds)

    struct DonorRecord {
        uint256 lastDonationTimestamp;
        uint256 totalVerifiedDonations;
        address lastVerifiedBy;
        bool exists;
    }

    // Pseudonymous donor identifier -> Verification Record
    mapping(bytes32 => DonorRecord) private donorRecords;

    // Authorized healthcare facility / hospital addresses
    mapping(address => bool) public authorizedVerifiers;

    // Events
    event VerifierUpdated(address indexed verifier, bool authorized);
    event MinimumIntervalUpdated(uint256 previousInterval, uint256 newInterval);
    event DonationRecorded(
        bytes32 indexed donorHash,
        uint256 donationTimestamp,
        address indexed verifier,
        uint256 totalDonations
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner || authorizedVerifiers[msg.sender],
            "Caller is not an authorized healthcare verifier"
        );
        _;
    }

    constructor(uint256 _initialIntervalDays) {
        owner = msg.sender;
        minIntervalSeconds = _initialIntervalDays * 1 days;
    }

    function setVerifier(address _verifier, bool _status) external onlyOwner {
        require(_verifier != address(0), "Invalid verifier address");
        authorizedVerifiers[_verifier] = _status;
        emit VerifierUpdated(_verifier, _status);
    }

    function updateMinIntervalDays(uint256 _newIntervalDays) external onlyOwner {
        require(_newIntervalDays > 0, "Interval must be greater than zero");
        uint256 previous = minIntervalSeconds;
        minIntervalSeconds = _newIntervalDays * 1 days;
        emit MinimumIntervalUpdated(previous, minIntervalSeconds);
    }

    /**
     * @notice Records a verified blood donation by an accredited hospital
     * @param _donorHash Keccak256 hash of the pseudonymous donor UUID
     * @param _donationTimestamp Epoch timestamp of donation (must be <= block.timestamp)
     */
    function recordDonation(bytes32 _donorHash, uint256 _donationTimestamp) external onlyAuthorized {
        require(_donorHash != bytes32(0), "Invalid donor hash");
        require(_donationTimestamp <= block.timestamp, "Timestamp cannot be in the future");

        DonorRecord storage record = donorRecords[_donorHash];
        if (record.exists) {
            require(
                _donationTimestamp >= record.lastDonationTimestamp + minIntervalSeconds,
                "Mandatory safety interval has not elapsed since previous donation"
            );
        }

        record.lastDonationTimestamp = _donationTimestamp;
        record.totalVerifiedDonations += 1;
        record.lastVerifiedBy = msg.sender;
        record.exists = true;

        emit DonationRecorded(
            _donorHash,
            _donationTimestamp,
            msg.sender,
            record.totalVerifiedDonations
        );
    }

    /**
     * @notice Checks whether the pseudonymous donor is eligible based on the safety interval
     * @param _donorHash Keccak256 hash of the pseudonymous donor UUID
     * @return isSatisfied True if interval has elapsed or donor is first-time
     * @return nextEligibleTimestamp Timestamp when donor can safely donate next
     * @return totalDonations Count of verified donations on-chain
     */
    function checkEligibility(bytes32 _donorHash)
        external
        view
        returns (
            bool isSatisfied,
            uint256 nextEligibleTimestamp,
            uint256 totalDonations
        )
    {
        DonorRecord memory record = donorRecords[_donorHash];
        if (!record.exists || record.lastDonationTimestamp == 0) {
            return (true, block.timestamp, 0);
        }

        uint256 nextEligible = record.lastDonationTimestamp + minIntervalSeconds;
        bool satisfied = block.timestamp >= nextEligible;
        return (satisfied, nextEligible, record.totalVerifiedDonations);
    }
}
