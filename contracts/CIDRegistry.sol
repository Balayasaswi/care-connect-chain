// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CIDRegistry {
    struct CidEntry {
        string ownerId;
        address submittedBy;
        string cid;
        uint256 timestamp;
    }

    CidEntry[] private entries;

    event CidStored(string indexed ownerId, string cid, address indexed submittedBy, uint256 timestamp);

    function storeCidForOwner(string calldata ownerId, string calldata cid) external {
        require(bytes(ownerId).length > 0, "Owner required");
        require(bytes(cid).length > 0, "CID required");
        entries.push(CidEntry({ ownerId: ownerId, submittedBy: msg.sender, cid: cid, timestamp: block.timestamp }));
        emit CidStored(ownerId, cid, msg.sender, block.timestamp);
    }

    // Backward-compatible helper for older clients that only provide a CID.
    // Uses sender address string as ownerId.
    function storeCid(string calldata cid) external {
        storeCidForOwner(_toHexString(msg.sender), cid);
    }

    function getEntryCount() external view returns (uint256) {
        return entries.length;
    }

    function getEntry(uint256 index) external view returns (string memory, string memory, address, uint256) {
        CidEntry storage entry = entries[index];
        return (entry.ownerId, entry.cid, entry.submittedBy, entry.timestamp);
    }

    function _toHexString(address account) private pure returns (string memory) {
        bytes20 value = bytes20(account);
        bytes16 hexSymbols = 0x30313233343536373839616263646566;
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = bytes1(hexSymbols[uint8(value[i] >> 4)]);
            str[3 + i * 2] = bytes1(hexSymbols[uint8(value[i] & 0x0f)]);
        }
        return string(str);
    }
}
